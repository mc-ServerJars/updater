const axios = require('axios');
const mysql = require('mysql2/promise');

// Database connection configuration
// TODO: Make this use dotenv
const dbConfig = {
    host: '...',
    user: '...',
    password: '...',
    database: '...'
};

const versionsGroups = [
    {
        fork: 'Vanilla',
        versions: [], // Vanilla versions will be dynamically fetched
        endpointBase: 'https://launchermeta.mojang.com/mc/game/version_manifest.json'
    },
    {
        fork: 'Folia',
        versions: ["1.19.4","1.20.1","1.20.2","1.20.4","1.20.6","1.21","1.21.1"],
        endpointBase: 'https://api.papermc.io/v2/projects/folia/versions/'
    },
    {
        fork: 'Paper',
        versions: ["1.8.8","1.9.4","1.10.2","1.11.2","1.12","1.12.1","1.12.2","1.13-pre7","1.13","1.13.1","1.13.2","1.14","1.14.1","1.14.2","1.14.3","1.14.4","1.15","1.15.1","1.15.2","1.16.1","1.16.2","1.16.3","1.16.4","1.16.5","1.17","1.17.1","1.18","1.18.1","1.18.2","1.19","1.19.1","1.19.2","1.19.3","1.19.4","1.20","1.20.1","1.20.2","1.20.4","1.20.5","1.20.6","1.21","1.21.1"],
        endpointBase: 'https://api.papermc.io/v2/projects/paper/versions/'
    },
    {
        fork: 'Purpur',
        versions: ["1.14.1","1.14.2","1.14.3","1.14.4","1.15","1.15.1","1.15.2","1.16.1","1.16.2","1.16.3","1.16.4","1.16.5","1.17","1.17.1","1.18","1.18.1","1.18.2","1.19","1.19.1","1.19.2","1.19.3","1.19.4","1.20","1.20.1","1.20.2","1.20.4","1.20.6","1.21","1.21.1"],
        endpointBase: 'https://api.purpurmc.org/v2/purpur/'
    },
    {
        fork: 'Velocity',
        versions: ["1.0.10","1.1.9","3.1.0","3.1.1","3.1.1-SNAPSHOT","3.1.2-SNAPSHOT","3.2.0-SNAPSHOT","3.3.0-SNAPSHOT"],
        endpointBase: 'https://api.papermc.io/v2/projects/velocity/versions/'
    },
    {
        fork: 'Waterfall',
        versions: ["1.11","1.12","1.13","1.14","1.15","1.16","1.17","1.18","1.19","1.20","1.21"],
        endpointBase: 'https://api.papermc.io/v2/projects/waterfall/versions/'
    },
    {
        fork: 'Pufferfish',
        versions: ["1.8.8","1.9.4","1.10.2","1.11.2","1.12","1.12.1","1.12.2","1.13-pre7","1.13","1.13.1","1.13.2","1.14","1.14.1","1.14.2","1.14.3","1.14.4","1.15","1.15.1","1.15.2","1.16.1","1.16.2","1.16.3","1.16.4","1.16.5","1.17","1.17.1","1.18","1.18.1","1.18.2","1.19","1.19.1","1.19.2","1.19.3","1.19.4","1.20","1.20.1","1.20.2","1.20.4","1.20.5","1.20.6","1.21","1.21.1"], // Update with relevant versions
        endpointBase: 'https://versions.mcjars.app/api/v2/builds/pufferfish/'
    }
];

async function dbConnect() {
    const connection = await mysql.createConnection(dbConfig);
    return connection;
}

async function processVanillaVersions() {
    const connection = await dbConnect();

    try {
        console.log(`[Vanilla] Starting processing...`);

        const endpoint = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
        const response = await axios.get(endpoint);
        const manifestData = response.data;

        if (manifestData.versions) {
            for (const version of manifestData.versions) {
                const versionName = version.id;
                const serverVersionEndpoint = version.url;

                try {
                    const serverVersionResponse = await axios.get(serverVersionEndpoint);
                    const serverVersionData = serverVersionResponse.data;

                    if (serverVersionData.downloads && serverVersionData.downloads.server) {
                        const serverInfo = serverVersionData.downloads.server;
                        const serverDownloadLink = serverInfo.url;

                        const [rows] = await connection.execute(
                            "SELECT COUNT(*) AS count FROM `minecraft_versions` WHERE `fork` = 'Vanilla' AND `build_number` = '0' AND `download_link` = ?",
                            [serverDownloadLink]
                        );

                        if (rows[0].count > 0) {
                            console.log(`[Vanilla] Version '${versionName}' already exists in the database. Skipping.`);
                        } else {
                            await connection.execute(
                                "INSERT INTO `minecraft_versions` (`fork`, `build_number`, `download_link`, `game_version`) VALUES (?, '0', ?, ?)",
                                ['Vanilla', serverDownloadLink, versionName]
                            );
                            console.log(`[Vanilla] Version '${versionName}' added to the database.`);
                        }
                    } else {
                        console.log(`[Vanilla] Server information not found in the JSON for version '${versionName}'. Skipping.`);
                    }
                } catch (error) {
                    console.error(`[Vanilla] Failed to retrieve server version data for '${versionName}':`, error.message);
                }
            }
        } else {
            console.log(`[Vanilla] No versions found in the manifest.`);
        }
    } finally {
        await connection.end();
        console.log(`[Vanilla] Processing complete.`);
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
                const response = await axios.get(endpoint, { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } });
                const responseData = response.data;

                // Log the full response data for debugging
                //console.log(`[${fork}] Response data for version '${versionName}':`, JSON.stringify(responseData, null, 2));

                if (fork === 'Purpur' || fork === 'Pufferfish') {
                    if (fork === 'Purpur' && responseData.builds && responseData.builds.all) {
                        for (const build of responseData.builds.all) {
                            const [rows] = await connection.execute(
                                "SELECT COUNT(*) AS count FROM `minecraft_versions` WHERE `fork` = ? AND `game_version` = ? AND `build_number` = ?",
                                [fork, versionName, build]
                            );

                            if (rows[0].count > 0) {
                                console.log(`[${fork}] Version '${versionName}' build '${build}' already exists in the database.`);
                            } else {
                                const downloadLink = `${endpointBase}${versionName}/builds/${build}/downloads/${fork.toLowerCase()}-${versionName}-${build}.jar`;
                                await connection.execute(
                                    "INSERT INTO `minecraft_versions` (`fork`, `build_number`, `download_link`, `game_version`) VALUES (?, ?, ?, ?)",
                                    [fork, build, downloadLink, versionName]
                                );
                                console.log(`[${fork}] Version '${versionName}' build '${build}' added to the database.`);
                            }
                        }
                    } else if (fork === 'Pufferfish' && responseData.builds) {
                        for (const build of responseData.builds) {
                            const buildNumber = build.buildNumber;
                            const downloadLink = build.jarUrl;

                            const [rows] = await connection.execute(
                                "SELECT COUNT(*) AS count FROM `minecraft_versions` WHERE `fork` = ? AND `game_version` = ? AND `build_number` = ?",
                                [fork, versionName, buildNumber]
                            );

                            if (rows[0].count > 0) {
                                console.log(`[${fork}] Version '${versionName}' build '${buildNumber}' already exists in the database.`);
                            } else {
                                await connection.execute(
                                    "INSERT INTO `minecraft_versions` (`fork`, `build_number`, `download_link`, `game_version`) VALUES (?, ?, ?, ?)",
                                    [fork, buildNumber, downloadLink, versionName]
                                );
                                console.log(`[${fork}] Version '${versionName}' build '${buildNumber}' added to the database.`);
                            }
                        }
                    } else {
                        console.log(`[${fork}] No builds found or unexpected data format for version '${versionName}'.`);
                    }
                } else {
                    if (Array.isArray(responseData.builds)) {
                        for (const build of responseData.builds) {
                            const [rows] = await connection.execute(
                                "SELECT COUNT(*) AS count FROM `minecraft_versions` WHERE `fork` = ? AND `game_version` = ? AND `build_number` = ?",
                                [fork, versionName, build]
                            );

                            if (rows[0].count > 0) {
                                console.log(`[${fork}] Version '${versionName}' build '${build}' already exists in the database.`);
                            } else {
                                const downloadLink = `${endpointBase}${versionName}/builds/${build}/downloads/${fork.toLowerCase()}-${versionName}-${build}.jar`;
                                await connection.execute(
                                    "INSERT INTO `minecraft_versions` (`fork`, `build_number`, `download_link`, `game_version`) VALUES (?, ?, ?, ?)",
                                    [fork, build, downloadLink, versionName]
                                );
                                console.log(`[${fork}] Version '${versionName}' build '${build}' added to the database.`);
                            }
                        }
                    } else {
                        console.log(`[${fork}] No builds found or unexpected data format for version '${versionName}'.`);
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

async function main() {
    await processVanillaVersions();

    for (const group of versionsGroups) {
        if (group.fork !== 'Vanilla') {
            await processVersions(group.fork, group.versions, group.endpointBase);
        }
    }
    console.log("All forks processing complete.");
    console.log("Exiting...");
    process.exit(100)
}

main().catch(console.error);
