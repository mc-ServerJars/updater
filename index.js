const axios = require('axios');
const mysql = require('mysql2/promise');

// Configuration with memory optimizations
const CONFIG = {
    headers: {
        "User-Agent": "Server Jars updating agent/1.0"
    },
    db: {
        host: "...",
        user: "...",
        password: "...",
        database: "..."
    },
    webhookUrl: "", // Empty string disables Discord notifications
    forkConcurrency: 2, // Reduced concurrency
    versionBatchSize: 3, // Process versions in small batches
    versionlist: [
        "1.14", "1.14.1", "1.14.2", "1.14.3", "1.14.4", 
        "1.15", "1.15.1", "1.15.2", 
        "1.16.1", "1.16.2", "1.16.3", "1.16.4", "1.16.5", 
        "1.17", "1.17.1", "1.18", 
        "1.18.1", "1.18.2", "1.19", "1.19.1", "1.19.2", "1.19.3", "1.19.4", 
        "1.20", "1.20.1", "1.20.2", "1.20.4", "1.20.5", "1.20.6", 
        "1.21", "1.21.1", "1.21.2", "1.21.3", "1.21.4", "1.21.5", "1.21.6", "1.21.7"
    ],
    forks: [
        { name: 'Vanilla', endpoint: 'https://versions.mcjars.app/api/v2/builds/vanilla/' },
        { name: 'Folia', endpoint: 'https://versions.mcjars.app/api/v2/builds/folia/' },
        { name: 'Paper', endpoint: 'https://versions.mcjars.app/api/v2/builds/paper/' },
        { name: 'Purpur', endpoint: 'https://versions.mcjars.app/api/v2/builds/purpur/' },
        { name: 'Velocity', endpoint: 'https://versions.mcjars.app/api/v2/builds/velocity/' },
        { name: 'Waterfall', endpoint: 'https://versions.mcjars.app/api/v2/builds/waterfall/' },
        { name: 'Pufferfish', endpoint: 'https://versions.mcjars.app/api/v2/builds/pufferfish/' },
        { name: 'Arclight', endpoint: 'https://versions.mcjars.app/api/v2/builds/arclight/' },
        { name: 'Sponge', endpoint: 'https://versions.mcjars.app/api/v2/builds/sponge/' },
        { name: 'Leaves', endpoint: 'https://versions.mcjars.app/api/v2/builds/leaves/' },
        { name: 'Mohist', endpoint: 'https://versions.mcjars.app/api/v2/builds/mohist/' },
        { name: 'Quilt', endpoint: 'https://versions.mcjars.app/api/v2/builds/quilt/' },
        { name: 'BungeeCord', endpoint: 'https://versions.mcjars.app/api/v2/builds/bungeecord/' },
        { name: 'Fabric', endpoint: 'https://versions.mcjars.app/api/v2/builds/fabric/' }
    ]
};

// Create database connection pool with conservative settings
const pool = mysql.createPool({
    ...CONFIG.db,
    waitForConnections: true,
    connectionLimit: CONFIG.forkConcurrency * 2, // Based on fork concurrency
    queueLimit: 0
});

// Memory monitoring
function logMemoryUsage() {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`[MEMORY] Used: ${used.toFixed(2)} MB`);
}

// Log memory every 10 seconds
setInterval(logMemoryUsage, 10000);

async function notifyDiscord(fork, version, build, name, downloadUrl) {
    // Only send notifications if webhook URL is provided
    if (!CONFIG.webhookUrl || CONFIG.webhookUrl.trim() === '') {
        return;
    }
    
    try {
        await axios.post(CONFIG.webhookUrl, {
            username: "Build Bot",
            embeds: [{
                title: `New Build Detected: ${name}`,
                description: `A new build has been added to the database.`,
                fields: [
                    { name: "Fork", value: fork, inline: true },
                    { name: "Version", value: version, inline: true },
                    { name: "Build Number", value: build, inline: true },
                    { name: "Download Link", value: `[Download Here](${downloadUrl})`, inline: false }
                ],
                color: 3066993
            }]
        }, { timeout: 5000 }); // Add timeout
        console.log(`[${fork}] Discord notification sent for ${name}`);
    } catch (error) {
        console.error(`[${fork}] Discord notification failed:`, error.message);
    }
}

async function processBuild(connection, fork, version, build) {
    const buildNumber = build.buildNumber || '0';
    const name = build.name;
    const downloadUrl = build.jarUrl || build.zipUrl || '';

    if (!name) {
        console.error(`[${fork}] Skipping build ${buildNumber} for ${version}: Missing name`);
        return;
    }

    if (!downloadUrl) {
        console.error(`[${fork}] Skipping build ${buildNumber} for ${version}: No download URL`);
        return;
    }

    const [rows] = await connection.execute(
        `SELECT 1 FROM minecraft_versions 
        WHERE fork = ? AND game_version = ? AND name = ? 
        LIMIT 1`,
        [fork, version, name]
    );

    if (rows.length > 0) {
        console.log(`[${fork}] ${version} build ${name} already exists`);
        return;
    }

    await connection.execute(
        `INSERT INTO minecraft_versions 
        (fork, build_number, download_link, game_version, name) 
        VALUES (?, ?, ?, ?, ?)`,
        [fork, buildNumber, downloadUrl, version, name]
    );

    console.log(`[${fork}] Added ${version} build ${name} (#${buildNumber})`);
    await notifyDiscord(fork, version, buildNumber, name, downloadUrl);
}

async function processVersion(connection, fork, version, endpointBase) {
    try {
        // Add ?tracking=none parameter to all API requests
        const url = `${endpointBase}${version}?tracking=none`;
        const response = await axios.get(url, { 
            headers: CONFIG.headers,
            timeout: 10000 // 10 second timeout
        });
        
        const builds = response.data.builds || [];
        if (builds.length === 0) {
            console.log(`[${fork}] No builds found for ${version}`);
            return;
        }

        for (const build of builds) {
            await processBuild(connection, fork, version, build);
        }
    } catch (error) {
        if (error.response?.status === 404) {
            console.log(`[${fork}] Version ${version} not found`);
        } else {
            console.error(`[${fork}] Version ${version} error:`, error.message);
        }
    }
}

async function processFork(fork) {
    console.log(`[${fork.name}] Starting processing`);
    const connection = await pool.getConnection();

    try {
        // Process versions in batches
        for (let i = 0; i < CONFIG.versionlist.length; i += CONFIG.versionBatchSize) {
            const batch = CONFIG.versionlist.slice(i, i + CONFIG.versionBatchSize);
            
            for (const version of batch) {
                await processVersion(connection, fork.name, version, fork.endpoint);
            }
            
            // Log memory after each batch
            logMemoryUsage();
        }
    } finally {
        connection.release();
        console.log(`[${fork.name}] Processing complete`);
    }
}

async function main() {
    try {
        // Process forks sequentially but versions in batches
        for (const fork of CONFIG.forks) {
            await processFork(fork);
            
            // Add a small delay between forks
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        console.log("All forks processed successfully");
    } catch (error) {
        console.error("Critical error:", error);
    } finally {
        await pool.end();
    }
}

// Start the process
console.log("Starting updater");
main().catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
});
