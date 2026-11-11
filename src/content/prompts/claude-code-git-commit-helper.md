---
title: "【Claude Code】git diffからConventional Commits準拠のコミット文を一発自動生成するプロンプト＆スクリプト"
description: "ターミナル上でステージングされた変更差分（git diff --staged）を読み取り、feat:, fix:, refactor: などの標準規格に沿った正確なコミットメッセージを自動生成するプロンプトです。"
category: "Claude Code自動化"
targetModel: "Claude Code"
timeSaved: "コミット思考時間 毎日15分削減"
pubDate: 2026-03-21
noteUrl: "https://note.com/example/claude-code-git-commit-helper"
promptText: |
  あなたは経験豊富なシニアソフトウェアエンジニア兼テックリードです。
  現在ステージングされている変更差分（git diff --cached）を分析し、
  チーム開発標準の「Conventional Commits v1.0.0」仕様に完全準拠したコミットメッセージを作成してください。

  【差分情報】
  [git diff --cached の出力を貼り付け、またはClaude Code環境で直接参照]

  【コミットメッセージの書式ルール】
  <type>(<scope>): <subject>

  [optional body]

  [optional footer(s)]

  【Typeの分類定義】
  - feat: 新機能の追加
  - fix: バグ修正
  - docs: ドキュメントのみの変更
  - style: コードの動作に影響しない書式や空白の調整
  - refactor: バグ修正や機能追加を含まないリファクタリング
  - perf: パフォーマンス向上のためのコード変更
  - test: テストの追加や既存テストの修正
  - chore: ビルドプロセスや補助ツールの変更

  【厳守要件】
  ・1行目のsubjectは50文字以内の簡潔な命令形（日本語または英語のプロジェクト方針に合わせる）
  ・本文（body）が必要な場合は、単なるコードの反復ではなく「なぜその変更が必要だったか（Why）」の背景を記述すること
  ・破壊的変更がある場合は「BREAKING CHANGE:」を明記すること
---

### プロンプトの実行手順とカスタマイズのコツ

コードを書くたびにコミットメッセージの英語やフォーマットに悩む時間は、開発のフロー体験を阻害します。Claude Codeを使えば、ステージングした瞬間に最適なコミットメッセージが生成されます。

#### 1. Claude Codeでのワンライナー実行手順
Claude Codeが起動しているターミナルで、以下のように指示するだけで完了します：

```bash
claude "git diff --cached を確認し、Conventional Commitsに従った適切なコミットメッセージを作成して git commit を実行して"
```

#### 2. エイリアス化による爆速運用
`.zshrc` や `.bashrc` に以下の関数やエイリアスを登録しておくと、`gc-ai` と打つだけで自動生成・確認プロンプトが表示され、開発効率が異次元に向上します。

```bash
alias gca="git add -A && claude 'ステージされた変更のConventional Commitメッセージを提案してコミットして'"
```

#### 3. チームルールに合わせたカスタマイズ
GitHubのIssue番号（`#123` など）をプレフィックスに含めるルールがある場合は、「先頭に `[#123]` を付与して」とプロンプトに追加してください。
