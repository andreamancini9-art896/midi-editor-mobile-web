# MIDI 音乐编辑器 — 软件架构计划

## Context
从零构建一款音乐工具：上传音频/哼唱 → AI 转 MIDI → 钢琴卷帘编辑 → 导出标准 MIDI 文件。技术栈选用 React + TypeScript (前端) 和 Python 3.11 FastAPI (后端)，Python 3.11 是 TensorFlow 音频 ML 库的最佳兼容版本，使用 venv 隔离依赖。

---

## 1. 项目结构

```
D:/编程/1 midi生成/
├── frontend/                    # React SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── PianoRoll/       # 钢琴卷帘编辑器（Canvas）
│   │   │   │   ├── PianoRoll.tsx
│   │   │   │   ├── NoteCanvas.tsx
│   │   │   │   ├── PianoKeyboard.tsx
│   │   │   │   ├── GridBackground.tsx
│   │   │   │   └── hooks/
│   │   │   │       ├── useNoteEditing.ts
│   │   │   │       └── usePianoRollZoom.ts
│   │   │   ├── Transport/       # 播放控制栏
│   │   │   │   └── TransportBar.tsx
│   │   │   ├── Upload/          # 文件上传 + 录音
│   │   │   │   ├── AudioUploader.tsx
│   │   │   │   └── VoiceRecorder.tsx
│   │   │   ├── TrackList/       # 音轨列表
│   │   │   │   └── TrackList.tsx
│   │   │   ├── Toolbar/         # 编辑工具栏
│   │   │   │   └── Toolbar.tsx
│   │   │   └── Export/          # 导出面板
│   │   │       └── ExportDialog.tsx
│   │   ├── stores/              # Zustand 状态管理
│   │   │   ├── useProjectStore.ts   # 项目/音轨/MIDI 数据
│   │   │   ├── useEditorStore.ts    # 编辑器状态（选中、缩放）
│   │   │   └── usePlayerStore.ts    # 播放状态
│   │   ├── hooks/
│   │   │   ├── useAudioToMidi.ts
│   │   │   ├── useMidiPlayback.ts
│   │   │   └── useKeyboardShortcuts.ts
│   │   ├── api/
│   │   │   └── client.ts           # FastAPI 调用封装
│   │   ├── utils/
│   │   │   ├── midi.ts             # MIDI 数据工具函数
│   │   │   └── audio.ts            # 音频工具函数
│   │   ├── types/
│   │   │   ├── midi.ts             # MIDI 类型定义
│   │   │   └── editor.ts           # 编辑器类型定义
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI 入口
│   │   ├── config.py               # 配置
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── routes.py           # API 路由
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── audio_to_midi.py    # 音频→MIDI 转换
│   │   │   ├── midi_io.py          # MIDI 文件读写
│   │   │   └── pitch_detection.py  # 音高检测（哼唱）
│   │   └── models/
│   │       ├── __init__.py
│   │       └── schemas.py          # Pydantic 模型
│   ├── requirements.txt
│   └── tests/
│       └── test_conversion.py
├── venv/                           # Python 3.11 虚拟环境（gitignore）
├── .claude/
│   ├── settings.local.json         # 项目级权限和钩子
│   └── skills/                     # 自定义技能
│       ├── midi-convert.md
│       ├── midi-edit.md
│       └── midi-export.md
├── CLAUDE.md                       # 项目文档 + AI 协作规范
├── .gitignore
└── .eslintrc.cjs
```

---

## 2. 技术栈选型

| 层 | 技术 | 原因 |
|----|------|------|
| 前端框架 | React 18 + TypeScript | 组件化、类型安全 |
| 构建工具 | Vite 6 | 快速 HMR、原生 ESM |
| 样式 | Tailwind CSS 3 | 快速开发、dark mode 内置 |
| 状态管理 | Zustand | 轻量、TS 友好、无 boilerplate |
| 钢琴卷帘 | HTML5 Canvas | 高性能像素渲染、可控 |
| MIDI 播放 | Tone.js | Web Audio API 封装、内置合成器 |
| 后端框架 | FastAPI | 异步、自动文档、文件上传 |
| 音频→MIDI（多音） | basic-pitch (Spotify) | TensorFlow 模型、和弦识别 |
| 音频→MIDI（哼唱） | CREPE + 后处理 | 单音音高追踪精度高 |
| MIDI 处理 | pretty_midi | 完整 MIDI 读写、语义化 API |
| Python 版本 | 3.11（venv 隔离） | 所有 ML 库兼容 |

---

## 3. MIDI 数据模型

```typescript
// 前端 MIDI 类型 (frontend/src/types/midi.ts)
interface MidiNote {
  id: string;
  pitch: number;       // MIDI 音符号 0-127
  startTime: number;   // 开始节拍（beats）
  duration: number;    // 持续节拍（beats）
  velocity: number;    // 力度 0-127
  track: number;       // 所属音轨索引
}

interface MidiTrack {
  id: string;
  name: string;
  instrument: number;  // GM 乐器编号 0-127
  notes: MidiNote[];
  isMuted: boolean;
  isSolo: boolean;
}

interface Project {
  bpm: number;
  timeSignature: [number, number];  // [分子, 分母]
  tracks: MidiTrack[];
}
```

---

## 4. API 路由设计

```
POST   /api/upload-audio        # 上传音频文件，返回文件 ID
POST   /api/convert-to-midi     # 音频→MIDI 转换（body: {fileId, mode: "poly"|"mono"}）
GET    /api/download-midi       # 导出 MIDI 文件下载（query: projectData as JSON）
```

所有路由在 `backend/app/api/routes.py`，服务实现在 `backend/app/services/`。

---

## 5. 组件树与数据流

```
App
├── TransportBar          ← usePlayerStore (play/stop/seek)
├── Toolbar               ← useEditorStore (tool, quantize, snap)
├── main-content (flex)
│   ├── TrackList          ← useProjectStore (tracks, mute/solo)
│   └── PianoRoll          ← useProjectStore + useEditorStore
│       ├── PianoKeyboard
│       ├── GridBackground
│       └── NoteCanvas     ← Canvas 渲染 + 交互
└── ExportDialog           ← 触发 /api/download-midi
```

**数据流**：
1. 用户上传音频 → `POST /api/upload-audio` → 返回 fileId
2. 用户触发转换 → `POST /api/convert-to-midi` → 返回 MIDI JSON (MidiTrack[])
3. 前端写入 `useProjectStore.tracks` → PianoRoll 渲染
4. 用户编辑 → Zustand 更新 notes → PianoRoll 重绘
5. 用户导出 → MIDI JSON 序列化 → `GET /api/download-midi` → 下载 .mid 文件

---

## 6. 处理管线

```
音频上传 (WAV/MP3/OGG)
  → 后端保存到临时目录
  → 用户选择模式：多音（乐器）/ 单音（哼唱）
  → basic-pitch (多音) 或 CREPE (单音) 推理
  → 输出音符列表 (pitch, start, duration, velocity)
  → 按音色聚类分轨（多音模式可选）
  → 返回 JSON 给前端
  → 前端渲染到钢琴卷帘
  → 用户编辑（画音符、拖拽、删除、调力度、量化）
  → 导出：前端 JSON → 后端 pretty_midi → MIDI 文件下载
```

---

## 7. Claude Code 配置

### 7.1 settings.local.json
```json
{
  "permissions": {
    "allow": [
      "Bash(npm:*)",
      "Bash(python:*)",
      "Bash(pip:*)",
      "Bash(mkdir:*)",
      "Bash(npx:*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'EDIT: ${CLAUDE_TOOL_FILE_PATH}'"
          }
        ]
      }
    ]
  }
}
```

### 7.2 项目编码规范（写入 CLAUDE.md）
- TypeScript strict mode，禁止 any
- React 函数组件 + Hooks，无 class 组件
- 组件文件：一个组件一个文件
- 状态管理：Zustand store 按领域拆分
- Python：类型注解强制（mypy strict）
- 命名：前端 camelCase、后端 snake_case
- 禁止引入新的第三方依赖，除非先讨论
- Canvas 绘制逻辑与交互逻辑分离
- 所有 API 路由必须 Pydantic 验证输入

### 7.3 自定义 Skills
1. **midi-convert** — 调试音频转 MIDI 管线
2. **midi-edit** — MIDI 编辑操作（量化、移调、力度缩放）
3. **midi-export** — MIDI 导出与格式转换

---

## 8. 强制限制

1. **不引入数据库**：本项目为单机工具，MIDI 数据仅在内存/JSON 中流转
2. **不引入认证/用户系统**：本地单用户
3. **文件大小上限**：上传音频 ≤ 50MB
4. **前端不直接调用 ML 模型**：所有推理走后端，避免浏览器兼容问题
5. **TypeScript strict mode**：不允许 `any` 逃逸
6. **Python 类型注解覆盖率 100%**：mypy strict 模式通过
7. **Canvas 渲染 60fps**：钢琴卷帘必须流畅

---

## 9. 实施步骤

### Step 1: 项目初始化
- 创建 frontend/ (Vite + React + TS + Tailwind)
- 创建 backend/ (FastAPI + venv + requirements.txt)
- 配置 .gitignore, CLAUDE.md, settings.local.json
- 安装依赖

### Step 2: 后端 — MIDI 文件读写
- 实现 pretty_midi 读写服务（不依赖 ML）
- 实现 `GET /api/download-midi` 端点
- 测试：创建简单音符 → 导出 → 验证 .mid 文件

### Step 3: 后端 — 音频转 MIDI
- 安装 basic-pitch, CREPE, TensorFlow
- 实现 `POST /api/upload-audio` 端点
- 实现 `POST /api/convert-to-midi` 端点
- 测试：上传测试音频 → 输出 MIDI JSON

### Step 4: 前端 — 基础 UI + 上传
- App 布局（TransportBar + 主区域）
- AudioUploader + VoiceRecorder 组件
- API 客户端封装
- 测试：上传音频 → 显示转换结果

### Step 5: 前端 — 钢琴卷帘编辑器
- PianoRoll 容器 + PianoKeyboard + GridBackground
- NoteCanvas Canvas 渲染（音符矩形 + 交互热区）
- useNoteEditing hook（draw/drag/resize/delete）
- usePianoRollZoom hook（滚轮缩放 + 拖拽平移）
- 测试：所有编辑操作

### Step 6: 前端 — 播放与导出
- Tone.js MIDI 播放（useMidiPlayback）
- TransportBar 播放控制
- ExportDialog → 下载 .mid 文件
- 测试：端到端流程

### Step 7: 集成测试与优化
- 完整流程测试：上传 → 转换 → 编辑 → 播放 → 导出
- Canvas 性能优化（脏矩形、requestAnimationFrame）
- 键盘快捷键（空格播放、Delete 删除、Ctrl+Z 撤销）

---

## 10. 验证方式

1. **后端验证**：`curl` 上传测试音频 → 检查返回的 MIDI JSON 包含有效音符
2. **前端验证**：启动 Vite dev server → 浏览器操作完整流程
3. **导出验证**：下载 .mid 文件 → 用 DAW/播放器打开确认
4. **编辑验证**：钢琴卷帘绘制音符 → Tone.js 播放声音正确
5. **类型检查**：`npx tsc --noEmit` (前端) + `mypy backend/` (后端) 均通过
