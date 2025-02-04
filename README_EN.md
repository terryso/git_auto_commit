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
3. Run the command:

```bash
git-auto-commit [options]
```

### Command Options

- `--language <zh|en>`: Set the commit message language (default: Chinese)
- `--auto`: Enable automatic commit mode, skip confirmation

The tool will:
1. Analyze current code changes
2. Generate commit message using AI
3. Display the generated commit message and wait for confirmation (unless --auto option is used)
4. Execute the commit

## Environment Variables

Before using, you need to set the following environment variable:

```bash
SILICONFLOW_API_KEY=your-api-key
```

You can set this by creating a `.env` file or setting it in your system environment.

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