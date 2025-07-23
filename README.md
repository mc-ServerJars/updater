# Minecraft Server Jars Indexer

![Minecraft](https://img.shields.io/badge/Minecraft-1.21.3-green?logo=minecraft)
![Node.js](https://img.shields.io/badge/Node.js-18.x-brightgreen?logo=node.js)
![MySQL](https://img.shields.io/badge/MySQL-8.0-blue?logo=mysql)

A Node.js service that automatically indexes Minecraft server jars from various forks and versions, stores them in a MySQL database, and sends Discord notifications for new builds.

## Features

- 🧩 Supports 14+ Minecraft server forks (Paper, Fabric, Purpur, etc.)
- 🔄 Automatically checks for new builds
- 💾 Stores metadata in MySQL database
- 🔔 Discord notifications for new builds
- ⚡ Concurrent processing with configurable limits
- 📦 Single-file implementation for easy deployment

## Supported Forks

| Fork Name | API Endpoint |
|-----------|--------------|
| Vanilla | `https://versions.mcjars.app/api/v2/builds/vanilla/` |
| Folia | `https://versions.mcjars.app/api/v2/builds/folia/` |
| Paper | `https://versions.mcjars.app/api/v2/builds/paper/` |
| Purpur | `https://versions.mcjars.app/api/v2/builds/purpur/` |
| Velocity | `https://versions.mcjars.app/api/v2/builds/velocity/` |
| Waterfall | `https://versions.mcjars.app/api/v2/builds/waterfall/` |
| Pufferfish | `https://versions.mcjars.app/api/v2/builds/pufferfish/` |
| Arclight | `https://versions.mcjars.app/api/v2/builds/arclight/` |
| Sponge | `https://versions.mcjars.app/api/v2/builds/sponge/` |
| Leaves | `https://versions.mcjars.app/api/v2/builds/leaves/` |
| Mohist | `https://versions.mcjars.app/api/v2/builds/mohist/` |
| Quilt | `https://versions.mcjars.app/api/v2/builds/quilt/` |
| BungeeCord | `https://versions.mcjars.app/api/v2/builds/bungeecord/` |
| Fabric | `https://versions.mcjars.app/api/v2/builds/fabric/` |

## Prerequisites

- Node.js v18 or higher
- MySQL 8.0+ database
- Discord webhook URL (for notifications)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/mc-ServerJars/updater.git
cd updater
```

2. Install dependencies:
```bash
npm install
```

3. Create the database table:
```sql
CREATE TABLE `minecraft_versions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `fork` VARCHAR(50) NOT NULL,
  `build_number` VARCHAR(20) NOT NULL,
  `download_link` VARCHAR(512) NOT NULL,
  `game_version` VARCHAR(20) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_build` (`fork`,`game_version`,`name`)
);
```

## Configuration

Edit the top section of `index.js` with your configuration:

```javascript
const CONFIG = {
    headers: {
        "User-Agent": "Server Jars updating agent/1.0"
    },
    db: {
        host: "your-db-host",
        user: "your-db-user",
        password: "your-db-password",
        database: "your-db-name"
    },
    webhookUrl: "your-discord-webhook-url",
    concurrencyLimit: 8,
    versionlist: [
        "1.14", "1.14.1", "1.14.2", 
        // ... other versions ...
        "1.21.3"
    ],
    forks: [
        { name: 'Vanilla', endpoint: 'https://versions.mcjars.app/api/v2/builds/vanilla/' },
        // ... other forks ...
    ]
};
```

## Usage

Run the indexer:
```bash
node index.js
```

### Sample Output
```
[Vanilla] Starting processing
[Vanilla] Processing version: 1.14
[Vanilla] Added 1.14 build vanilla-1.14 (#123)
[Vanilla] Discord notification sent for vanilla-1.14
[Folia] Starting processing
...
All forks processed successfully
```

### Running as a Service

Create a systemd service (`/etc/systemd/system/minecraft-indexer.service`):

```ini
[Unit]
Description=Minecraft Server Jars Indexer
After=network.target

[Service]
User=nodeuser
WorkingDirectory=/path/to/indexer
ExecStart=/usr/bin/node /path/to/indexer/index.js
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
```

Then enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable minecraft-indexer
sudo systemctl start minecraft-indexer
```

## Database Schema

| Column | Type | Description |
|--------|------|-------------|
| id | INT UNSIGNED | Auto-increment primary key |
| fork | VARCHAR(50) | Server fork name (e.g., "Paper") |
| build_number | VARCHAR(20) | Build number |
| download_link | VARCHAR(512) | Direct download URL |
| game_version | VARCHAR(20) | Minecraft version (e.g., "1.20.1") |
| name | VARCHAR(100) | Build name (e.g., "paper-1.20.1-456") |
| created_at | TIMESTAMP | Timestamp of record creation |

## Discord Notifications

The service sends formatted messages to Discord when new builds are detected:

<img width="392" height="213" alt="image" src="https://github.com/user-attachments/assets/0696d8ca-3427-4f2b-b1ed-8f1f32503c1b" />

## Monitoring

Check service status:
```bash
sudo systemctl status minecraft-indexer
```

View logs:
```bash
journalctl -u minecraft-indexer -f
```

## License

Apache 2.0 License - See [LICENSE](LICENSE) for details.
If you do not understand this license, please view [Choose A License's page on it](https://choosealicense.com/licenses/apache-2.0/).
