const axios = require('axios');
const mysql = require('mysql2/promise');

// Configuration
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
    webhookUrl: "...",
    concurrencyLimit: 8,
    versionlist: [
        "1.14", "1.14.1", "1.14.2", "1.14.3", "1.14.4", "1.15", "1.15.1", "1.15.2", 
        "1.16.1", "1.16.2", "1.16.3", "1.16.4", "1.16.5", "1.17", "1.17.1", "1.18", 
        "1.18.1", "1.18.2", "1.19", "1.19.1", "1.19.2", "1.19.3", "1.19.4", "1.20", 
        "1.20.1", "1.20.2", "1.20.4", "1.20.5", "1.20.6", "1.21", "1.21.1", "1.21.2", "1.21.3"
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

// Create database connection pool
const pool = mysql.createPool({
    ...CONFIG.db,
    waitForConnections: true,
    connectionLimit: CONFIG.concurrencyLimit + 2,
    queueLimit: 0
});

async function notifyDiscord(fork, version, build, name, downloadUrl) {
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
        });
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
        const response = await axios.get(`${endpointBase}${version}`, { headers: CONFIG.headers });
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
        for (const version of CONFIG.versionlist) {
            await processVersion(connection, fork.name, version, fork.endpoint);
        }
    } finally {
        connection.release();
        console.log(`[${fork.name}] Processing complete`);
    }
}

async function main() {
    try {
        const tasks = [];
        const activeTasks = new Set();

        for (const fork of CONFIG.forks) {
            const task = async () => {
                try {
                    await processFork(fork);
                } finally {
                    activeTasks.delete(task);
                }
            };

            tasks.push(task);
        }

        while (tasks.length > 0) {
            if (activeTasks.size < CONFIG.concurrencyLimit) {
                const task = tasks.shift();
                activeTasks.add(task);
                task();
            } else {
                await Promise.race([...activeTasks]);
            }
        }

        await Promise.all([...activeTasks]);
        console.log("All forks processed successfully");
    } catch (error) {
        console.error("Critical error:", error);
        process.exit(1);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

main();
