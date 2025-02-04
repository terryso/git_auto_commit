import { Given } from '@cucumber/cucumber';
import { expect } from 'chai';
import { ICustomWorld } from '../support/world';
import * as path from 'path';
import * as fsPromises from 'fs/promises';

declare module '@cucumber/cucumber' {
    interface World extends ICustomWorld {}
}

Given('存在未提交的文件变更', async function() {
    const world = this as unknown as ICustomWorld;
    const testFile = path.join(world.testRepoPath, 'test.txt');
    try {
        // 确保文件不存在
        await fsPromises.rm(testFile, { force: true });
        // 创建新文件
        await fsPromises.writeFile(testFile, 'test content');
        // 添加到暂存区
        await world.gitClient.cwd(world.testRepoPath).add('.');
        // 等待一段时间确保文件被正确添加
        await new Promise(resolve => setTimeout(resolve, 1000));
        // 获取状态
        world.initialStatus = await world.gitClient.cwd(world.testRepoPath).status();
        
        const hasChanges = world.initialStatus.files.length > 0 || 
                          world.initialStatus.staged.length > 0 || 
                          world.initialStatus.not_added.length > 0 || 
                          world.initialStatus.modified.length > 0 ||
                          world.initialStatus.created.length > 0 ||
                          world.initialStatus.deleted.length > 0;
                          
        if (!hasChanges) {
            throw new Error('没有检测到文件变更');
        }
    } catch (error) {
        console.error('创建测试文件失败:', error);
        throw error;
    }
}); 