const axios = require('axios');
const mysql = require('mysql2/promise');

const headers = {
  "User-Agent":
    "Server Jars updating agent/1.0",
};

// Database connection configuration
const dbConfig = {
    host: "...";,
    user: "...";,
    password: "...";,
    database: "...";
};

const webhookUrl = "...";
//"1.6.2","1.6.3","1.6.4","1.7.2","1.7.10-pre4","1.7.10","1.8","1.8.8", "1.9.4", "1.10.2", "1.11.2", "1.12", "1.12.1", "1.12.2", "1.13-pre7", "1.13", "1.13.1", "1.13.2", 
const versionlist = ["1.14", "1.14.1", "1.14.2", "1.14.3", "1.14.4", "1.15", "1.15.1", "1.15.2", "1.16.1", "1.16.2", "1.16.3", "1.16.4", "1.16.5", "1.17", "1.17.1", "1.18", "1.18.1", "1.18.2", "1.19", "1.19.1", "1.19.2", "1.19.3", "1.19.4", "1.20", "1.20.1", "1.20.2", "1.20.4", "1.20.5", "1.20.6", "1.21", "1.21.1", "1.21.2","1.21.3"];

const versionsGroups = [
    {
        fork: 'Vanilla',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/vanilla/'
    },
    {
        fork: 'Folia',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/folia/'
    },
    {
        fork: 'Paper',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/paper/'
    },
    {
        fork: 'Purpur',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/purpur/'
    },
    {
        fork: 'Velocity',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/velocity/'
    },
    {
        fork: 'Waterfall',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/waterfall/'
    },
    {
        fork: 'Pufferfish',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/pufferfish/'
    },
    {
        fork: 'Arclight',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/arclight/'
    },
    {
        fork: 'Sponge',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/sponge/'
    },
    {
        fork: 'Leaves',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/leaves/'
    },
    {
        fork: 'Mohist',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/mohist/'
    },
    /**{
        fork: 'NeoForge',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/neoforge/'
    },
    {
        fork: 'Forge',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/forge/'
    },**/
    {
        fork: 'Quilt',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/quilt/'
    },
    {
        fork: 'BungeeCord',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/bungeecord/'
    },
    {
        fork: 'Fabric',
        versions: versionlist,
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/fabric/'
    }
];

async function dbConnect() {
    const connection = await mysql.createConnection(dbConfig);
    return connection;
}

async function sendToDiscord(fork, versionName, buildNumber, name, downloadLink) {
    const embed = {
        title: `New Build Detected: ${name}`,
        description: `A new build has been added to the database.`,
        fields: [
            { name: "Fork", value: fork, inline: true },
            { name: "Version", value: versionName, inline: true },
            { name: "Build Number", value: buildNumber, inline: true },
            { name: "Download Link", value: `[Download Here](${downloadLink})`, inline: false }
        ],
        color: 3066993 // Example color, you can change this to any other
    };

    const payload = {
        username: "Build Bot",
        embeds: [embed]
    };

    try {
        await axios.post(webhookUrl, payload);
        console.log(`Notification sent to Discord for ${name}`);
    } catch (error) {
        console.error("Error sending notification to Discord:", error.message);
    }
}

async function processVersions(fork, versions, endpointBase) {
    const connection = await dbConnect();

    try {
        console.log(`[${fork}] Starting processing...`);

        for (const versionName of versions) {
            const endpoint = `${endpointBase}${versionName}`;
            console.log(`[${fork}] Processing version: ${versionName}`);

            try {
                const response = await axios.get(endpoint, { headers });
                const buildsData = response.data.builds || [];

                for (const build of buildsData) {
                    const buildNumber = build.buildNumber || '0';
                    const name = build.name || null;
                    let downloadLink = '';
                    if (build.jarUrl) {
                        downloadLink = build.jarUrl || '';
                    } else {
                        downloadLink = build.zipUrl || '';
                    }

                    if (name) {
                        const [rows] = await connection.execute(
                            "SELECT COUNT(*) AS count FROM `minecraft_versions` WHERE `fork` = ? AND `game_version` = ? AND `name` = ?",
                            [fork, versionName, name]
                        );

                        if (rows[0].count > 0) {
                            console.log(`[${fork}] Version '${versionName}' build name '${name}' already exists in the database.`);
                        } else {
                            if (downloadLink == '') return;
                            await connection.execute(
                                "INSERT INTO `minecraft_versions` (`fork`, `build_number`, `download_link`, `game_version`, `name`) VALUES (?, ?, ?, ?, ?)",
                                [fork, buildNumber, downloadLink, versionName, name]
                            );
                            console.log(`[${fork}] Version '${versionName}' build '${buildNumber}' and name '${name}' added to the database.`);
                            
                            // Send notification to Discord
                            await sendToDiscord(fork, versionName, buildNumber, name, downloadLink);
                        }
                    } else {
                        console.error(`[${fork}] Build name is missing for version '${versionName}', skipping insertion.`);
                    }
                }
            } catch (error) {
                console.error(`[${fork}] Error processing version '${versionName}':`, error.message);
            }
        }
    } finally {
        await connection.end();
        console.log(`[${fork}] Processing complete.`);
    }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
    const concurrencyLimit = 8;
    const taskQueue = [];

    for (const group of versionsGroups) {
        taskQueue.push(async () => {
            await processVersions(group.fork, group.versions, group.endpointBase);
        });
    }

    const asyncTasks = [];

    while (taskQueue.length > 0) {
        while (asyncTasks.length < concurrencyLimit && taskQueue.length > 0) {
            const task = taskQueue.shift();
            asyncTasks.push(task());
        }

        await Promise.all(asyncTasks);
        asyncTasks.length = 0; // Clear the array
    }

    console.log("All forks processing complete.");
    await sleep(60000);
    console.log("Exiting...");
    process.exit(100);
}

main().catch(console.error);
