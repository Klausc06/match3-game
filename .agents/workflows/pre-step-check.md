---
description: 开始新的开发步骤前的检查流程
---

# 开发 Step 前置检查工作流

// turbo-all

每次开始一个新的开发 Step 之前，执行以下流程：

## 1. 加载项目规则
使用你的 `view_file` 工具读取 `.agents/skills/project-rules/SKILL.md`。
确认当前 Step 在开发顺序中的位置。

## 2. 加载架构指南
使用你的 `view_file` 工具读取 `.agents/skills/architecture/SKILL.md`。
确认要使用的事件名和接口签名。

## 3. 检查已有代码
使用你的 `grep_search` 或 `list_dir` 工具查看 `js/` 目录结构。
确认哪些模块已完成，避免重复创建或遗漏依赖。

## 4. 确认当前 Step 的输入输出
- 本 Step 依赖哪些已完成模块？查阅它们。
- 本 Step 产出的模块会被谁依赖？确认接口匹配。

## 5. 写代码
执行必要的代码更改。

## 6. 测试
运行 `npm test` 确保所有单元测试通过。如果需要由于视觉变更验证，开启或提示用户检查 `http://localhost:8765`。

## 7. 更新任务清单
完成后在 `task.md` 标记该 Step 为 `[x]`。
