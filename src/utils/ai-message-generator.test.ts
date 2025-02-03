import { expect } from 'chai';
import * as sinon from 'sinon';
import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import { generateAIMessage } from './ai-message-generator';
import { OpenAI } from 'openai';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

interface APIError extends Error {
    response?: {
        data: {
            error: {
                message: string;
            };
        };
    };
}

describe('ai-message-generator', () => {
    let gitStub: sinon.SinonStubbedInstance<SimpleGit>;
    let mockOpenAIClient: OpenAI;
    let openAIStub: sinon.SinonStub;
    
    beforeEach(() => {
        sinon.restore();
        
        // 创建 SimpleGit 存根
        const git = simpleGit();
        gitStub = sinon.stub(git) as any;
        
        // 创建 OpenAI client mock
        openAIStub = sinon.stub().rejects(new Error('默认错误'));
        mockOpenAIClient = {
            chat: {
                completions: {
                    create: openAIStub
                }
            }
        } as any;
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('generateAIMessage', () => {
        it('应该正确生成提交信息', async function() {
            this.timeout(10000);
            
            // 准备测试数据
            const mockStatus: Partial<StatusResult> = {
                not_added: ['new-file.ts'],
                modified: ['modified-file.ts'],
                deleted: ['deleted-file.ts'],
                renamed: [{ from: 'old.ts', to: 'new.ts' }],
                files: [],
                staged: [],
                created: [],
                conflicted: [],
                isClean: () => false
            };
            const mockDiff = '+ new line\n- old line\n+ modified line';

            // 设置存根
            gitStub.status.resolves(mockStatus as StatusResult);
            gitStub.diff.resolves(mockDiff);
            openAIStub.resolves({
                choices: [{ 
                    message: { 
                        content: 'feat: 添加新文件并修改现有功能'
                    } 
                }]
            });

            // 执行测试
            const message = await generateAIMessage(gitStub, mockOpenAIClient);
            expect(message).to.match(/^feat: /);
            expect(message).to.not.include('new-file.ts');
            expect(message).to.not.include('modified-file.ts');
            expect(message.length).to.be.lessThan(30);
        });

        it('应该处理 AI 服务错误', async function() {
            this.timeout(10000);
            
            // 准备测试数据
            const mockStatus: Partial<StatusResult> = {
                not_added: [],
                modified: ['test.ts'],
                deleted: [],
                renamed: [],
                files: [],
                staged: [],
                created: [],
                conflicted: [],
                isClean: () => false
            };

            // 设置存根
            gitStub.status.resolves(mockStatus as StatusResult);
            gitStub.diff.resolves('test diff');
            
            // 模拟 OpenAI API 错误
            openAIStub.rejects(new Error('API 调用失败'));

            // 执行测试
            await expect(generateAIMessage(gitStub, mockOpenAIClient))
                .to.be.rejectedWith('AI服务错误：API 调用失败');
        });

        it('应该处理空响应', async function() {
            this.timeout(10000);
            
            // 设置存根
            const mockStatus: Partial<StatusResult> = {
                not_added: [],
                modified: ['test.ts'],
                deleted: [],
                renamed: [],
                files: [],
                staged: [],
                created: [],
                conflicted: [],
                isClean: () => false
            };

            // 设置存根
            gitStub.status.resolves(mockStatus as StatusResult);
            gitStub.diff.resolves('test diff');
            openAIStub.resolves({
                choices: []
            });

            // 执行测试
            await expect(generateAIMessage(gitStub, mockOpenAIClient))
                .to.be.rejectedWith('AI 未能生成有效的提交信息');
        });
    });
}); 