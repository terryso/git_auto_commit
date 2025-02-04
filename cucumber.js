module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['features/**/*.ts'],
    format: process.env.CI ? ['progress'] : ['progress-bar'],
    language: 'zh-CN'
  }
} 