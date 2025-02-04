# Git AI Commit Message Generator

[简体中文](./README.md) | English

A command-line tool that uses AI to automatically generate Git commit messages.

## Features

- Automatically analyze code changes and generate standardized commit messages
- Support for both Chinese and English commit messages
- Interactive confirmation mechanism (optional)
- Support for automatic commit mode
- Automatic error handling

## Installation

```bash
npm install -g @terryso/git-auto-commit
```

## Usage

1. Ensure your project is a Git repository
2. Add files to the staging area
3. Configure API Key:
```bash
git-auto-commit config set apiKey "your-api-key"
```
4. Run the command:
```bash
git-auto-commit [options]
```

### Command Options

- `--en`: Generate commit message in English (default: Chinese)
- `-y, --auto-confirm`: Enable auto-confirm mode, skip confirmation
- `config`: Configuration management
  - `set <key> <value>`: Set a configuration value
  - `get <key>`: Get a configuration value
  - `list`: List all configurations
  - `remove <key>`: Remove a configuration value

Examples:
```bash
# Use English, auto-confirm
git-auto-commit --en -y

# Use Chinese, manual confirmation
git-auto-commit

# Configure API Key
git-auto-commit config set apiKey "your-api-key"
```

The tool will:
1. Analyze current code changes
2. Generate commit message using AI
3. Display the generated commit message and wait for confirmation (unless --auto option is used)
4. Execute the commit

## API Key Configuration

### Method 1: Configuration Command (Recommended)
```bash
git-auto-commit config set apiKey "your-api-key"
```

### Method 2: Configuration File
Manually edit the configuration file:
```bash
mkdir -p ~/.config/git-auto-commit
echo '{"apiKey": "your-api-key"}' > ~/.config/git-auto-commit/config.json
```

### Important Notes
1. Never commit your API Key to the repository
2. Configuration file location: ~/.config/git-auto-commit/config.json
3. How to get API Key:
   1. Visit https://siliconflow.cn
   2. Register/Login to your account
   3. Create API Key in the console

## Commit Message Format

The tool summarizes up to 3 major changes in the commit message:
```
<type>: <major change 1>
<type>: <major change 2>
<type>: <major change 3>
```

Where:
- type: Must be either feat (new feature) or fix (bug fix)
- Each change description is concise, not exceeding 20 words
- AI analyzes all changes and extracts 2-3 most important modifications
- For minor changes, might generate only 1-2 lines of commit message

Example commit message:
```
feat: add English commit message support
feat: implement auto-commit mode without confirmation
fix: resolve configuration file reading issue
```

> Note: The tool intelligently analyzes code changes and extracts the most important points. If you have numerous or complex changes, it's recommended to split them into separate commits for better tracking and code history management.

## Error Handling

The tool will display error messages in the following cases:
- Current directory is not a valid Git repository
- No changes detected for commit
- AI service is unavailable

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run BDD tests
npm run test:bdd

# Build
npm run build
```

## License

MIT 