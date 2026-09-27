export const demoCases={
  healthy:{title:'健康项目',expected:'PASS',reason:'真实测试、TypeScript 类型检查、构建、指定修改与文件存在要求全部通过。'},
  'no-tests':{title:'没有真实测试',expected:'WARN',reason:'npm 默认 placeholder 不算测试；类型检查和构建继续运行。'},
  'test-failure':{title:'真实断言失败',expected:'BLOCK',reason:'把加法错误写成减法；测试必须失败，后续类型检查与构建仍执行。'},
  pageerror:{title:'页面运行时错误',expected:'BLOCK',reason:'本地页面真实抛出 pageerror，保存截图、Trace 和失败反馈。'},
  'resource-overflow':{title:'记录上限后的关键资源失败',expected:'BLOCK',reason:'大量跨源错误之后，同源脚本 404 仍必须阻断；不能因日志截断漏判。'},
  'unsafe-path':{title:'脚本新建外部 symlink',expected:'ERROR',reason:'脚本执行后路径逃出仓库，必须报环境/路径错误，不得伪造 PASS 或 BLOCK。'}
};
export function demoCase(name){const selected=demoCases[name];if(!Object.hasOwn(demoCases,name))throw new Error('Unknown demo scenario');return selected;}
