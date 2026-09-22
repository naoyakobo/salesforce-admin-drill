import { readFileSync } from "node:fs";

const markdown = readFileSync("Salesforce_Admin_Practice_Questions_Draft.md", "utf8");
const notes = readFileSync("Salesforce_Admin_Study_Notes.md", "utf8");
const inputNotes = readFileSync("Salesforce_Admin_Input_Notes.md", "utf8");
const answerStart = markdown.indexOf("## 正答と解説");
const questionPart = markdown.slice(0, answerStart);
const answerPart = markdown.slice(answerStart);
const answers = {};

for (const line of answerPart.split(/\r?\n/)) {
  const match = line.match(/^\| (Q\d{3}) \| ([^|]+) \| (.+) \|$/);
  if (match) {
    answers[match[1]] = {
      correct: match[2].split(",").map((value) => value.trim()),
      explanation: match[3].trim(),
    };
  }
}

const questions = questionPart.split(/^#### /m).slice(1).map((block) => {
  const lines = block.trim().split(/\r?\n/);
  const header = lines.shift();
  const headerMatch = header.match(/^(Q\d{3}) \[(単一選択|複数選択: (\d+)つ)\]$/);
  if (!headerMatch) return null;

  const choices = [];
  for (const line of lines) {
    const choice = line.match(/^([A-Z])\. (.+)$/);
    if (choice) choices.push({ key: choice[1], text: choice[2].trim() });
  }
  return {
    id: headerMatch[1],
    required: Number(headerMatch[3] || 1),
    choices,
    ...answers[headerMatch[1]],
  };
}).filter(Boolean);

const invalid = questions.filter((question) => (
  !question.correct
  || !question.explanation
  || question.choices.length < 2
  || question.correct.length !== question.required
  || question.correct.some((key) => !question.choices.some((choice) => choice.key === key))
));

const requiredNoteHeadings = [
  "## まず押さえる全体像",
  "## データモデルと関係",
  "## 権限と共有",
  "## 自動化",
  "## レポートとダッシュボード",
  "## 試験直前の判断チェック",
];
const missingNoteHeadings = requiredNoteHeadings.filter((heading) => !notes.includes(heading));
const requiredInputHeadings = [
  "## 運用ルール",
  "## 現在反映済みのインプット範囲",
  "## 追記ログ",
];
const missingInputHeadings = requiredInputHeadings.filter((heading) => !inputNotes.includes(heading));

if (questions.length !== 150 || Object.keys(answers).length !== 150 || invalid.length || missingNoteHeadings.length || missingInputHeadings.length) {
  console.error({
    questions: questions.length,
    answers: Object.keys(answers).length,
    invalid: invalid.map(({ id }) => id),
    missingNoteHeadings,
    missingInputHeadings,
  });
  process.exitCode = 1;
} else {
  console.log("Question bank valid: 150 questions, 150 answers, 0 invalid entries. Study notes and input ledger valid.");
}
