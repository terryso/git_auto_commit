import { setWorldConstructor, IWorldOptions, World } from '@cucumber/cucumber';
import { SimpleGit } from 'simple-git';
import { SinonSandbox, SinonStub } from 'sinon';
import simpleGit from 'simple-git';
import sinon from 'sinon';
import * as path from 'path';

export interface ICustomWorld {
    testRepoPath: string;
    gitClient: SimpleGit;
    commandError: Error | null;
    exitCode: number;
    lastCommitMessage: string;
    lastOutput: string;
    initialStatus: any;
    generateAIMessageStub: SinonStub;
    sandbox: SinonSandbox;
    generatedMessage: string;
    parameters: any;
    attachFile(data: string | Buffer, mediaType?: string): void;
    logMessage(text: string): void;
    init(): Promise<void>;
}

export class CustomWorld extends World implements ICustomWorld {
    public testRepoPath: string;
    public gitClient: SimpleGit;
    public commandError: Error | null;
    public exitCode: number;
    public lastCommitMessage: string;
    public lastOutput: string;
    public initialStatus: any;
    public generateAIMessageStub: SinonStub;
    public sandbox: SinonSandbox;
    public generatedMessage: string;
    public parameters: any;

    constructor(options: IWorldOptions) {
        super(options);
        this.testRepoPath = path.join(process.cwd(), 'test-repo');
        this.gitClient = simpleGit();
        this.commandError = null;
        this.exitCode = 0;
        this.lastCommitMessage = '';
        this.lastOutput = '';
        this.initialStatus = null;
        this.sandbox = sinon.createSandbox();
        this.generateAIMessageStub = sinon.stub();
        this.generatedMessage = '';
        this.parameters = options.parameters;
    }

    public async init(): Promise<void> {
        // 初始化方法，在Before钩子中调用
    }

    public attachFile(data: string | Buffer, mediaType?: string): void {
        // 实现 attach 方法
        console.log('Attachment:', data);
    }

    public logMessage(text: string): void {
        console.log(text);
    }
}

setWorldConstructor(CustomWorld); 