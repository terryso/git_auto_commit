import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

const CONFIG_DIR = path.join(os.homedir(), '.git-auto-commit');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface Config {
    apiKey?: string;
}

export function getConfig(): Config {
    try {
        if (!fs.existsSync(CONFIG_DIR)) {
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        }
        
        if (!fs.existsSync(CONFIG_FILE)) {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify({}, null, 2));
            return {};
        }

        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        return config;
    } catch (error) {
        return {};
    }
}

export function setConfig(config: Config): void {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getApiKey(): string | undefined {
    const config = getConfig();
    return config.apiKey;
}

export function setApiKey(apiKey: string): void {
    const config = getConfig();
    config.apiKey = apiKey;
    setConfig(config);
} 