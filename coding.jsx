import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  GitCommit,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  EyeOff,
  ExternalLink,
  FolderGit2,
  ChevronDown,
  Settings2,
  Play,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";

/* ---------------------------------------------------------------- *
 *  Language configuration: extensions, starter code, keyword sets
 * ---------------------------------------------------------------- */

const JS_COMMENT = "\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/";
const JS_STRING =
  '`(?:\\\\.|[^`\\\\])*`|"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'';

const LANG_CONFIG = {
  javascript: {
    label: "JavaScript",
    ext: "js",
    runnable: true,
    sample: "function pairSumToTarget(nums, target) {\n    // write your solution here\n    \n}\n",
    keywords: [
      "const","let","var","function","return","if","else","for","while","do","switch",
      "case","break","continue","class","extends","new","this","super","try","catch",
      "finally","throw","typeof","instanceof","in","of","null","undefined","true",
      "false","async","await","yield","import","export","default","static","get","set",
    ],
    commentPattern: JS_COMMENT,
    stringPattern: JS_STRING,
  },
  java: {
    label: "Java",
    ext: "java",
    runnable: false,
    sample:
      'public class Solution {\n    public static void main(String[] args) {\n        \n    }\n}\n',
    keywords: [
      "abstract","assert","boolean","break","byte","case","catch","char","class",
      "const","continue","default","do","double","else","enum","extends","final",
      "finally","float","for","goto","if","implements","import","instanceof","int",
      "interface","long","native","new","package","private","protected","public",
      "return","short","static","strictfp","super","switch","synchronized","this",
      "throw","throws","transient","try","void","volatile","while","String",
      "System","true","false","null",
    ],
    commentPattern: JS_COMMENT,
    stringPattern: '"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'',
  },
  cpp: {
    label: "C++",
    ext: "cpp",
    runnable: false,
    sample:
      "#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n",
    keywords: [
      "int","float","double","char","bool","void","long","short","unsigned","signed",
      "const","static","class","struct","public","private","protected","virtual",
      "override","namespace","using","include","define","if","else","for","while",
      "do","switch","case","break","continue","return","new","delete","try","catch",
      "throw","template","typename","auto","nullptr","true","false","std","cout",
      "cin","endl","vector","string","size_t",
    ],
    commentPattern: JS_COMMENT,
    stringPattern: '"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'',
  },
  python: {
    label: "Python",
    ext: "py",
    runnable: false,
    sample: 'def pair_sum_to_target(nums, target):\n    pass\n',
    keywords: [
      "def","class","import","from","as","return","if","elif","else","for","while",
      "break","continue","pass","try","except","finally","raise","with","lambda",
      "yield","global","nonlocal","assert","del","in","is","not","and","or","True",
      "False","None","print","self","__init__",
    ],
    commentPattern: "#[^\\n]*",
    stringPattern:
      '"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'',
  },
};

const LANG_ORDER = ["javascript", "java", "cpp", "python"];

const TOKEN_REGEX = Object.fromEntries(
  Object.entries(LANG_CONFIG).map(([key, cfg]) => {
    const kw = `\\b(?:${cfg.keywords.join("|")})\\b`;
    const pattern = `(${cfg.commentPattern})|(${cfg.stringPattern})|(\\b\\d+(?:\\.\\d+)?\\b)|(${kw})`;
    return [key, new RegExp(pattern, "g")];
  })
);

function tokenize(code, langKey) {
  const regex = TOKEN_REGEX[langKey];
  regex.lastIndex = 0;
  const tokens = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "plain", text: code.slice(lastIndex, match.index) });
    }
    let type = "plain";
    if (match[1] !== undefined) type = "comment";
    else if (match[2] !== undefined) type = "string";
    else if (match[3] !== undefined) type = "number";
    else if (match[4] !== undefined) type = "keyword";
    tokens.push({ type, text: match[0] });
    lastIndex = regex.lastIndex;
    if (match[0].length === 0) regex.lastIndex += 1;
  }
  if (lastIndex < code.length) tokens.push({ type: "plain", text: code.slice(lastIndex) });
  return tokens;
}

/* ---------------------------------------------------------------- *
 *  Small helpers
 * ---------------------------------------------------------------- */

function slugify(s) {
  const slug = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return slug || "misc";
}

function sanitizeFilename(name, ext) {
  let n = (name || "").trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-");
  const suffix = "." + ext;
  if (n.toLowerCase().endsWith(suffix)) n = n.slice(0, -suffix.length);
  return n || "Solution";
}

function b64EncodeUnicode(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode("0x" + p1)
    )
  );
}

function encodePath(path) {
  return path
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function parseFnName(sig) {
  const m = (sig || "").match(/^\s*([A-Za-z_$][\w$]*)\s*\(/);
  return m ? m[1] : null;
}

function buildStubFromSignature(sig) {
  const m = (sig || "").match(/^\s*([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*$/);
  if (!m) return null;
  return `function ${m[1]}(${m[2].trim()}) {\n    // write your solution here\n    \n}\n`;
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === "object") {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function formatValue(v) {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function runTestCase(code, fnName, testCase) {
  const now = typeof performance !== "undefined" ? () => performance.now() : () => Date.now();
  try {
    const runner = new Function(
      `"use strict";\n${code}\nreturn ${fnName}(${testCase.input});`
    );
    const t0 = now();
    const actual = runner();
    const t1 = now();
    let expected;
    let expectedOk = true;
    try {
      expected = new Function(`"use strict"; return (${testCase.expected});`)();
    } catch {
      expectedOk = false;
      expected = testCase.expected;
    }
    const pass = expectedOk
      ? deepEqual(actual, expected)
      : String(actual) === String(testCase.expected).trim();
    return { status: pass ? "pass" : "fail", actual, error: null, ms: Math.max(0, t1 - t0) };
  } catch (err) {
    return { status: "error", actual: null, error: (err && err.message) || String(err), ms: null };
  }
}

/* ---------------------------------------------------------------- *
 *  Default sample problem
 * ---------------------------------------------------------------- */

const DEFAULT_PROBLEM = {
  title: "Pair Sum to Target",
  difficulty: "Easy",
  description:
    "You're given a list of integers and a target value. Return the indices of the two entries that add up to the target. Assume exactly one valid pair exists, and you can't use the same element twice. The order of the two returned indices doesn't matter.",
  examples: [
    {
      input: "nums = [2, 7, 11, 15], target = 9",
      output: "[0, 1]",
      explanation: "nums[0] + nums[1] = 2 + 7 = 9.",
    },
    {
      input: "nums = [3, 2, 4], target = 6",
      output: "[1, 2]",
      explanation: "nums[1] + nums[2] = 2 + 4 = 6.",
    },
  ],
  constraints: [
    "2 <= nums.length <= 10^4",
    "-10^9 <= nums[i] <= 10^9",
    "Exactly one valid pair exists for the given target.",
  ],
  jsSignature: "pairSumToTarget(nums, target)",
};

const DEFAULT_TEST_CASES = [
  { id: "tc-1", input: "[2, 7, 11, 15], 9", expected: "[0, 1]" },
  { id: "tc-2", input: "[3, 2, 4], 6", expected: "[1, 2]" },
];

const DIFFICULTIES = ["Easy", "Medium", "Hard"];

/* ---------------------------------------------------------------- *
 *  Main component
 * ---------------------------------------------------------------- */

export default function CommitBench() {
  const [activeLang, setActiveLang] = useState("javascript");
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef(null);

  const [codeByLang, setCodeByLang] = useState(() => {
    const init = {};
    Object.keys(LANG_CONFIG).forEach((k) => (init[k] = LANG_CONFIG[k].sample));
    return init;
  });

  const [topic, setTopic] = useState("");
  const [filename, setFilename] = useState("Solution");
  const [showCommitMsg, setShowCommitMsg] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [rootFolder, setRootFolder] = useState("");

  const [connStatus, setConnStatus] = useState("idle");
  const [connUser, setConnUser] = useState("");
  const [connError, setConnError] = useState("");

  const [stage, setStage] = useState("idle");
  const [stageMessage, setStageMessage] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [ledger, setLedger] = useState([]);

  const [leftTab, setLeftTab] = useState("description");
  const [problem, setProblem] = useState(DEFAULT_PROBLEM);
  const [problemEdit, setProblemEdit] = useState(false);

  const [testCases, setTestCases] = useState(DEFAULT_TEST_CASES);
  const [selectedTcId, setSelectedTcId] = useState(DEFAULT_TEST_CASES[0].id);
  const [testResults, setTestResults] = useState({});
  const [running, setRunning] = useState(false);
  const [consoleTab, setConsoleTab] = useState("testcase");

  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const gutterRef = useRef(null);

  const code = codeByLang[activeLang];
  const ext = LANG_CONFIG[activeLang].ext;
  const isRunnable = LANG_CONFIG[activeLang].runnable;
  const lineCount = useMemo(() => code.split("\n").length, [code]);
  const tokens = useMemo(() => tokenize(code, activeLang), [code, activeLang]);

  const selectedTc = testCases.find((t) => t.id === selectedTcId) || testCases[0];

  const pathPreview = useMemo(() => {
    const slug = topic.trim() ? slugify(topic) : "topic";
    const fname = filename.trim() ? sanitizeFilename(filename, ext) : "file";
    return [rootFolder.trim(), slug, `${fname}.${ext}`].filter(Boolean).join("/");
  }, [rootFolder, topic, filename, ext]);

  const overallStatus = useMemo(() => {
    if (!testCases.length) return null;
    const allJudged = testCases.every((tc) => testResults[tc.id]);
    if (!allJudged) return null;
    if (testCases.some((tc) => testResults[tc.id].status === "error")) return "error";
    if (testCases.every((tc) => testResults[tc.id].status === "pass")) return "accepted";
    return "wrong";
  }, [testCases, testResults]);

  useEffect(() => {
    if (testCases.length && !testCases.some((t) => t.id === selectedTcId)) {
      setSelectedTcId(testCases[0].id);
    }
  }, [testCases, selectedTcId]);

  useEffect(() => {
    function onDocClick(e) {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) setLangMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function authHeaders() {
    return {
      Authorization: `Bearer ${token.trim()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  function updateCode(val) {
    setCodeByLang((prev) => ({ ...prev, [activeLang]: val }));
  }

  function handleScroll(e) {
    const { scrollTop, scrollLeft } = e.target;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
  }

  function handleKeyDown(e) {
    const el = e.target;
    if (e.key === "Tab") {
      e.preventDefault();
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = code.slice(0, start) + "    " + code.slice(end);
      updateCode(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 4;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const start = el.selectionStart;
      const before = code.slice(0, start);
      const lineStart = before.lastIndexOf("\n") + 1;
      const currentLine = before.slice(lineStart);
      const indentMatch = currentLine.match(/^[ \t]*/);
      let indent = indentMatch ? indentMatch[0] : "";
      const trimmed = currentLine.trim();
      const opensBlock =
        trimmed.endsWith("{") || (activeLang === "python" && trimmed.endsWith(":"));
      if (opensBlock) indent += "    ";
      const insertion = "\n" + indent;
      const next = code.slice(0, start) + insertion + code.slice(el.selectionEnd);
      updateCode(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + insertion.length;
      });
    }
  }

  /* --------------------------- Problem editing --------------------------- */

  function updateExample(idx, field, value) {
    setProblem((p) => {
      const examples = p.examples.slice();
      examples[idx] = { ...examples[idx], [field]: value };
      return { ...p, examples };
    });
  }
  function addExample() {
    setProblem((p) => ({
      ...p,
      examples: [...p.examples, { input: "", output: "", explanation: "" }],
    }));
  }
  function removeExample(idx) {
    setProblem((p) => ({ ...p, examples: p.examples.filter((_, i) => i !== idx) }));
  }
  function updateConstraint(idx, value) {
    setProblem((p) => {
      const constraints = p.constraints.slice();
      constraints[idx] = value;
      return { ...p, constraints };
    });
  }
  function addConstraint() {
    setProblem((p) => ({ ...p, constraints: [...p.constraints, ""] }));
  }
  function removeConstraint(idx) {
    setProblem((p) => ({ ...p, constraints: p.constraints.filter((_, i) => i !== idx) }));
  }

  function addTestCase() {
    const id = `tc-${Date.now()}`;
    setTestCases((prev) => [...prev, { id, input: "", expected: "" }]);
    setSelectedTcId(id);
  }
  function removeTestCase(id) {
    setTestCases((prev) => prev.filter((t) => t.id !== id));
  }
  function updateTestCase(id, field, value) {
    setTestCases((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  }
  function insertStub() {
    const stub = buildStubFromSignature(problem.jsSignature);
    if (stub) {
      setCodeByLang((prev) => ({ ...prev, javascript: stub }));
    }
  }

  /* --------------------------- Running tests --------------------------- */

  function runAllTests() {
    const fnName = parseFnName(problem.jsSignature);
    if (!fnName) {
      setStageMessage("Set a valid function signature first, like myFunc(a, b).");
      setStage("error");
      return null;
    }
    const results = {};
    testCases.forEach((tc) => {
      results[tc.id] = runTestCase(codeByLang.javascript, fnName, tc);
    });
    setTestResults(results);
    return results;
  }

  function handleRun() {
    if (!isRunnable || testCases.length === 0) return;
    setRunning(true);
    setTimeout(() => {
      runAllTests();
      setRunning(false);
      setConsoleTab("result");
    }, 120);
  }

  /* --------------------------- GitHub --------------------------- */

  async function verifyConnection() {
    if (!token.trim() || !owner.trim() || !repo.trim()) {
      setConnStatus("error");
      setConnError("Add a token, repo owner, and repo name first.");
      return;
    }
    setConnStatus("checking");
    setConnError("");
    try {
      const userRes = await fetch("https://api.github.com/user", { headers: authHeaders() });
      if (!userRes.ok) throw new Error("Token rejected — check it's valid and has repo access.");
      const userData = await userRes.json();

      const repoRes = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner.trim())}/${encodeURIComponent(
          repo.trim()
        )}`,
        { headers: authHeaders() }
      );
      if (!repoRes.ok) throw new Error(`Can't find ${owner}/${repo} — check the owner and repo name.`);
      const repoData = await repoRes.json();

      setConnUser(userData.login);
      setConnStatus("connected");
      if (!branch.trim() && repoData.default_branch) setBranch(repoData.default_branch);
    } catch (err) {
      setConnStatus("error");
      setConnError(err.message || "Couldn't verify the connection.");
    }
  }

  async function handleCommit() {
    if (!token.trim() || !owner.trim() || !repo.trim()) {
      setStage("error");
      setStageMessage("Add your token, repo owner, and repo name in settings first.");
      setSettingsOpen(true);
      return;
    }
    if (!topic.trim()) {
      setStage("error");
      setStageMessage('Give this submission a topic folder, like "arrays".');
      return;
    }
    if (!code.trim()) {
      setStage("error");
      setStageMessage("There's nothing written in the editor yet.");
      return;
    }

    if (isRunnable) {
      if (testCases.length === 0) {
        setStage("error");
        setStageMessage("Add at least one test case before submitting.");
        return;
      }
      const results = runAllTests();
      setConsoleTab("result");
      if (!results) return;
      const allPass = testCases.every((tc) => results[tc.id] && results[tc.id].status === "pass");
      if (!allPass) {
        setStage("error");
        setStageMessage("Not all test cases pass yet — fix those before this pushes.");
        return;
      }
    }

    setStage("pushing");
    setStageMessage("");

    try {
      const slug = slugify(topic);
      const fname = sanitizeFilename(filename, ext);
      const path = [rootFolder.trim(), slug, `${fname}.${ext}`].filter(Boolean).join("/");
      const apiUrl = `https://api.github.com/repos/${encodeURIComponent(
        owner.trim()
      )}/${encodeURIComponent(repo.trim())}/contents/${encodePath(path)}`;
      const targetBranch = branch.trim() || "main";

      let sha;
      const existing = await fetch(`${apiUrl}?ref=${encodeURIComponent(targetBranch)}`, {
        headers: authHeaders(),
      });
      if (existing.status === 200) {
        const data = await existing.json();
        sha = data.sha;
      } else if (existing.status !== 404) {
        const errData = await existing.json().catch(() => ({}));
        throw new Error(errData.message || `GitHub returned ${existing.status} while checking the file.`);
      }

      const body = {
        message: commitMessage.trim() || `Add ${slug}/${fname}.${ext}`,
        content: b64EncodeUnicode(code),
        branch: targetBranch,
      };
      if (sha) body.sha = sha;

      const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const putData = await putRes.json();
      if (!putRes.ok) throw new Error(putData.message || `GitHub rejected the push (status ${putRes.status}).`);

      const result = {
        path,
        sha: putData.commit && putData.commit.sha ? putData.commit.sha.slice(0, 7) : "",
        url: putData.content ? putData.content.html_url : "",
        time: new Date(),
      };
      setStage("success");
      setLastResult(result);
      setLedger((prev) => [{ id: Date.now(), ...result }, ...prev].slice(0, 30));
    } catch (err) {
      setStage("error");
      setStageMessage(err.message || "Something went wrong while pushing.");
    }
  }

  const connDotClass =
    connStatus === "connected"
      ? "dot dot-ok"
      : connStatus === "checking"
      ? "dot dot-checking"
      : connStatus === "error"
      ? "dot dot-err"
      : "dot";

  const diffClass =
    problem.difficulty === "Easy" ? "diff-easy" : problem.difficulty === "Hard" ? "diff-hard" : "diff-medium";

  return (
    <div className="bench-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap');

        .bench-root {
          --bg: #ffffff;
          --bg-alt: #f7f8fa;
          --bg-inset: #eef0f2;
          --border: #e4e6e8;
          --text: #262626;
          --text-muted: #737373;
          --green: #2cbb5d;
          --green-tint: rgba(44,187,93,0.10);
          --red: #ff375f;
          --red-tint: rgba(255,55,95,0.09);
          --yellow: #ffa116;
          --yellow-tint: rgba(255,161,22,0.14);
          --teal: #00af9b;
          --teal-tint: rgba(0,175,155,0.10);
          --tok-keyword: #0000ff;
          --tok-string: #a31515;
          --tok-comment: #008000;
          --tok-number: #098658;
          font-family: 'Inter', sans-serif;
          color: var(--text);
          background: var(--bg);
          border-radius: 10px;
          border: 1px solid var(--border);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: 760px;
        }
        .bench-root * { box-sizing: border-box; }
        .bench-root button { font-family: inherit; cursor: pointer; }
        .bench-root input, .bench-root textarea, .bench-root select { font-family: inherit; }
        .bench-root :focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }

        .bench-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 11px 18px; border-bottom: 1px solid var(--border); background: var(--bg);
          flex-shrink: 0;
        }
        .brand {
          display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14.5px; letter-spacing: -0.01em;
        }
        .brand svg { color: var(--yellow); }
        .conn-indicator {
          display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text-muted);
        }
        .dot { width: 7px; height: 7px; border-radius: 50%; background: #c8c8c8; flex-shrink: 0; }
        .dot-ok { background: var(--green); box-shadow: 0 0 0 3px rgba(44,187,93,0.16); }
        .dot-err { background: var(--red); box-shadow: 0 0 0 3px rgba(255,55,95,0.16); }
        .dot-checking { background: var(--yellow); animation: pulse 1s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .bench-body { display: flex; flex: 1; min-height: 0; border-top: 1px solid var(--border); }

        /* ---- Left: problem pane ---- */
        .problem-pane { width: 400px; flex-shrink: 0; background: var(--bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
        .problem-tabs { display: flex; gap: 4px; padding: 0 16px; border-bottom: 1px solid var(--border); background: var(--bg-alt); flex-shrink: 0; }
        .ptab {
          background: none; border: none; color: var(--text-muted); font-size: 12.5px; font-weight: 600;
          padding: 11px 6px; border-bottom: 2px solid transparent; margin-bottom: -1px;
        }
        .ptab.active { color: var(--text); border-bottom-color: var(--text); }
        .ptab:hover:not(.active) { color: var(--text); }
        .problem-tab-content { flex: 1; overflow-y: auto; padding: 18px; }

        .problem-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
        .problem-title { font-weight: 700; font-size: 17px; line-height: 1.3; }
        .edit-toggle {
          background: var(--bg-alt); border: 1px solid var(--border); color: var(--text-muted);
          border-radius: 6px; padding: 6px 8px; flex-shrink: 0; display: flex; align-items: center; gap: 5px;
          font-size: 11.5px; font-weight: 600;
        }
        .edit-toggle:hover { color: var(--text); }
        .badge-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .diff-badge { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 2px 9px; border-radius: 999px; }
        .diff-easy { color: var(--teal); background: var(--teal-tint); }
        .diff-medium { color: #b8790a; background: var(--yellow-tint); }
        .diff-hard { color: var(--red); background: var(--red-tint); }
        .topic-chip { font-size: 11.5px; font-weight: 600; padding: 2px 9px; border-radius: 999px; color: var(--text-muted); background: var(--bg-inset); }
        .diff-select { background: var(--bg-alt); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 4px 6px; font-size: 12px; }

        .problem-desc { font-size: 13.5px; line-height: 1.7; color: #3a3a3a; margin-bottom: 20px; white-space: pre-wrap; }
        .section-title {
          font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted);
          font-weight: 700; margin-bottom: 9px; display: flex; align-items: center; justify-content: space-between;
        }
        .example-card { background: var(--bg-alt); border: 1px solid var(--border); border-radius: 8px; padding: 11px 13px; margin-bottom: 10px; font-size: 12.5px; }
        .example-card b { color: var(--text); font-weight: 700; }
        .example-row { font-family: 'IBM Plex Mono', monospace; font-size: 12px; margin-top: 4px; word-break: break-word; color: #3a3a3a; }
        .example-explain { color: var(--text-muted); margin-top: 6px; font-size: 12px; line-height: 1.5; }
        .constraints-list { list-style: none; padding: 0; margin: 0 0 18px; }
        .constraints-list li { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #3a3a3a; padding-left: 14px; position: relative; margin-bottom: 7px; line-height: 1.5; }
        .constraints-list li:before { content: '·'; position: absolute; left: 2px; color: var(--yellow); font-weight: 700; }
        .sig-chip { font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: var(--text); background: var(--bg-alt); border: 1px solid var(--border); border-radius: 6px; padding: 6px 9px; display: inline-block; word-break: break-word; }

        .edit-row { display: flex; gap: 6px; align-items: flex-start; margin-bottom: 8px; }
        .edit-row .text-input { flex: 1; }
        textarea.text-input { resize: vertical; min-height: 32px; line-height: 1.5; }
        .icon-btn { background: var(--bg-alt); border: 1px solid var(--border); color: var(--text-muted); border-radius: 6px; padding: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .icon-btn:hover { color: var(--red); }
        .add-link { background: none; border: none; color: #b8790a; font-size: 12px; font-weight: 600; padding: 2px 0; display: flex; align-items: center; gap: 4px; }
        .add-link:hover { text-decoration: underline; }

        .text-input { background: var(--bg-alt); border: 1px solid var(--border); color: var(--text); padding: 7px 10px; border-radius: 7px; font-size: 12.5px; width: 100%; }
        .text-input::placeholder { color: #a3a3a3; }
        .text-input.mono { font-family: 'IBM Plex Mono', monospace; }

        /* ---- Submissions tab ---- */
        .empty-note { color: var(--text-muted); font-size: 13px; padding: 20px 0; text-align: center; }
        .sub-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .sub-table th { text-align: left; color: var(--text-muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 8px; border-bottom: 1px solid var(--border); }
        .sub-table td { padding: 9px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
        .sub-table a { color: var(--text); text-decoration: none; font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
        .sub-table a:hover { text-decoration: underline; }
        .status-pill { color: var(--green); background: var(--green-tint); font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }

        /* ---- Right: work pane ---- */
        .bench-main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--bg); }

        .toolbar {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 9px 14px; border-bottom: 1px solid var(--border); background: var(--bg); flex-shrink: 0; flex-wrap: wrap;
        }
        .lang-dropdown { position: relative; }
        .lang-dropdown-btn {
          background: var(--bg-alt); border: 1px solid var(--border); color: var(--text);
          padding: 7px 10px; border-radius: 7px; font-size: 12.5px; font-weight: 600;
          display: flex; align-items: center; gap: 6px;
        }
        .lang-dropdown-btn:hover { background: var(--bg-inset); }
        .lang-menu {
          position: absolute; top: calc(100% + 5px); left: 0; background: #fff; border: 1px solid var(--border);
          border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); min-width: 140px; z-index: 20; overflow: hidden;
        }
        .lang-menu-item { display: block; width: 100%; text-align: left; background: none; border: none; padding: 8px 12px; font-size: 12.5px; color: var(--text); }
        .lang-menu-item:hover { background: var(--bg-alt); }
        .lang-menu-item.active { color: #b8790a; font-weight: 700; background: var(--yellow-tint); }

        .toolbar-actions { display: flex; align-items: center; gap: 8px; }
        .run-btn, .commit-btn {
          display: flex; align-items: center; gap: 6px; border: none; padding: 8px 14px;
          border-radius: 6px; font-weight: 700; font-size: 12.5px; transition: filter 0.15s ease, transform 0.1s ease;
        }
        .run-btn { background: var(--bg-alt); color: var(--text); border: 1px solid var(--border); }
        .run-btn:hover:not(:disabled) { background: var(--bg-inset); }
        .commit-btn { background: var(--green); color: #ffffff; }
        .commit-btn:hover:not(:disabled) { filter: brightness(1.06); }
        .commit-btn:active:not(:disabled), .run-btn:active:not(:disabled) { transform: scale(0.97); }
        .commit-btn:disabled, .run-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .ticket {
          display: flex; align-items: center; gap: 10px; padding: 8px 14px;
          border-bottom: 1px solid var(--border); background: var(--bg-alt); flex-shrink: 0; flex-wrap: wrap;
        }
        .ticket .text-input { max-width: 150px; }
        .gear-btn { background: var(--bg); border: 1px solid var(--border); color: var(--text-muted); padding: 7px 8px; border-radius: 7px; display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600; }
        .gear-btn:hover, .gear-btn.open { color: var(--text); background: var(--bg-inset); }
        .ticket-path { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 100px; }
        .ticket-path b { color: var(--text); font-weight: 600; }
        .commit-msg-toggle { background: none; border: none; color: var(--text-muted); font-size: 11px; text-decoration: underline; }
        .commit-msg-toggle:hover { color: var(--text); }

        .settings-popover {
          position: absolute; top: calc(100% + 6px); right: 14px; width: 300px;
          background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 14px;
          display: flex; flex-direction: column; gap: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.14); z-index: 25;
        }
        .field-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 5px; display: block; font-weight: 700; }
        .field-group { display: flex; flex-direction: column; }
        .hint { font-size: 11px; color: var(--text-muted); margin-top: 4px; line-height: 1.4; }
        .token-row { position: relative; }
        .token-row .text-input { padding-right: 32px; }
        .eye-btn { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); padding: 4px; display: flex; }
        .eye-btn:hover { color: var(--text); }
        .verify-btn { background: var(--bg-alt); border: 1px solid var(--border); color: var(--text); padding: 8px 10px; border-radius: 7px; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .verify-btn:hover { background: var(--bg-inset); }
        .conn-msg { font-size: 11px; line-height: 1.4; }
        .conn-msg.ok { color: var(--green); }
        .conn-msg.err { color: var(--red); }

        .push-banner {
          display: flex; align-items: center; gap: 7px; padding: 8px 14px; font-size: 12px; font-weight: 600;
          border-bottom: 1px solid var(--border); flex-shrink: 0;
        }
        .push-banner.pushing { background: var(--bg-alt); color: var(--text-muted); }
        .push-banner.success { background: var(--green-tint); color: #1a8a44; }
        .push-banner.error { background: var(--red-tint); color: var(--red); }
        .push-banner a { color: inherit; text-decoration: underline; }

        .editor-wrap { flex: 1; display: flex; min-height: 140px; background: var(--bg); }
        .gutter { width: 44px; flex-shrink: 0; overflow: hidden; text-align: right; padding: 14px 8px 14px 0; font-family: 'IBM Plex Mono', monospace; font-size: 13px; line-height: 1.6; color: #c2c2c2; user-select: none; border-right: 1px solid var(--border); }
        .editor-layers { position: relative; flex: 1; min-width: 0; }
        .highlight-layer, .code-input { position: absolute; inset: 0; margin: 0; padding: 14px 16px; font-family: 'IBM Plex Mono', monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; overflow: auto; }
        .highlight-layer { color: var(--text); pointer-events: none; }
        .code-input { background: transparent; color: transparent; caret-color: var(--text); border: none; resize: none; -webkit-text-fill-color: transparent; }
        .code-input:focus { outline: none; }
        .tok-keyword { color: var(--tok-keyword); }
        .tok-string { color: var(--tok-string); }
        .tok-comment { color: var(--tok-comment); font-style: italic; }
        .tok-number { color: var(--tok-number); }

        .console-panel { border-top: 1px solid var(--border); background: var(--bg); flex-shrink: 0; max-height: 240px; display: flex; flex-direction: column; }
        .console-tabs { display: flex; gap: 4px; padding: 0 12px; border-bottom: 1px solid var(--border); background: var(--bg-alt); flex-shrink: 0; }
        .ctab { background: none; border: none; color: var(--text-muted); font-size: 12px; font-weight: 700; padding: 9px 4px; border-bottom: 2px solid transparent; margin-bottom: -1px; margin-right: 14px; }
        .ctab.active { color: var(--text); border-bottom-color: var(--text); }

        .tc-tabs { display: flex; align-items: center; gap: 6px; padding: 10px 12px 0; flex-wrap: wrap; }
        .tc-tab { background: var(--bg-alt); border: 1px solid var(--border); color: var(--text-muted); padding: 5px 10px; font-size: 11.5px; font-weight: 600; border-radius: 6px; display: flex; align-items: center; gap: 5px; }
        .tc-tab.active { color: var(--text); border-color: var(--text); }
        .tc-tab .dot { width: 6px; height: 6px; }
        .tc-add { background: none; border: 1px dashed var(--border); color: var(--text-muted); width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
        .tc-add:hover { color: #b8790a; border-color: var(--yellow); }
        .tc-detail { padding: 10px 12px; overflow-y: auto; }
        .tc-fields { display: flex; gap: 8px; }
        .tc-fields .field-group { flex: 1; }
        .tc-remove { background: none; border: none; color: var(--text-muted); font-size: 11px; margin-top: 8px; display: flex; align-items: center; gap: 4px; }
        .tc-remove:hover { color: var(--red); }
        .run-note { padding: 12px 14px; font-size: 12px; color: var(--text-muted); line-height: 1.5; }

        .result-content { padding: 12px 14px; overflow-y: auto; }
        .status-banner { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; padding: 9px 12px; border-radius: 8px; margin-bottom: 12px; }
        .status-banner.accepted { color: var(--green); background: var(--green-tint); }
        .status-banner.wrong { color: var(--red); background: var(--red-tint); }
        .status-banner.error { color: var(--red); background: var(--red-tint); }
        .case-result { border: 1px solid var(--border); border-radius: 8px; padding: 9px 11px; margin-bottom: 8px; font-size: 12px; }
        .case-result-head { display: flex; align-items: center; gap: 6px; font-weight: 700; margin-bottom: 6px; }
        .case-result-head.pass { color: var(--green); }
        .case-result-head.fail { color: var(--red); }
        .case-result-head.error { color: var(--red); }
        .case-result-row { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: #3a3a3a; margin-top: 3px; word-break: break-word; }
        .case-result-time { color: var(--text-muted); font-size: 11px; margin-top: 4px; font-family: 'IBM Plex Mono', monospace; }

        @media (max-width: 860px) {
          .bench-body { flex-direction: column; }
          .problem-pane { width: 100%; border-right: none; border-bottom: 1px solid var(--border); max-height: 300px; }
          .settings-popover { right: 12px; left: 12px; width: auto; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bench-root * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <header className="bench-header">
        <div className="brand">
          <FolderGit2 size={17} />
          Commit Bench
        </div>
        <div className="conn-indicator">
          <span className={connDotClass} />
          {connStatus === "connected"
            ? `connected as @${connUser}`
            : connStatus === "checking"
            ? "checking…"
            : connStatus === "error"
            ? "connection failed"
            : "not connected"}
        </div>
      </header>

      <div className="bench-body">
        <aside className="problem-pane">
          <div className="problem-tabs">
            <button type="button" className={`ptab${leftTab === "description" ? " active" : ""}`} onClick={() => setLeftTab("description")}>
              Description
            </button>
            <button type="button" className={`ptab${leftTab === "submissions" ? " active" : ""}`} onClick={() => setLeftTab("submissions")}>
              Submissions{ledger.length ? ` (${ledger.length})` : ""}
            </button>
          </div>

          <div className="problem-tab-content">
            {leftTab === "description" ? (
              <>
                <div className="problem-head">
                  {problemEdit ? (
                    <input
                      className="text-input"
                      style={{ fontWeight: 700, fontSize: "14.5px" }}
                      value={problem.title}
                      onChange={(e) => setProblem((p) => ({ ...p, title: e.target.value }))}
                    />
                  ) : (
                    <div className="problem-title">{problem.title}</div>
                  )}
                  <button type="button" className="edit-toggle" onClick={() => setProblemEdit((v) => !v)}>
                    <Pencil size={12} />
                    {problemEdit ? "Done" : "Edit"}
                  </button>
                </div>

                <div className="badge-row">
                  {problemEdit ? (
                    <select
                      className="diff-select"
                      value={problem.difficulty}
                      onChange={(e) => setProblem((p) => ({ ...p, difficulty: e.target.value }))}
                    >
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`diff-badge ${diffClass}`}>{problem.difficulty}</span>
                  )}
                  {topic.trim() && <span className="topic-chip">#{slugify(topic)}</span>}
                </div>

                {problemEdit ? (
                  <textarea
                    className="text-input"
                    style={{ minHeight: 90, marginBottom: 16 }}
                    value={problem.description}
                    onChange={(e) => setProblem((p) => ({ ...p, description: e.target.value }))}
                  />
                ) : (
                  <div className="problem-desc">{problem.description}</div>
                )}

                <div className="section-title">
                  Examples
                  {problemEdit && (
                    <button type="button" className="add-link" onClick={addExample}>
                      <Plus size={12} /> Add
                    </button>
                  )}
                </div>
                {problem.examples.map((ex, i) =>
                  problemEdit ? (
                    <div key={i} className="example-card">
                      <div className="edit-row">
                        <input className="text-input mono" placeholder="Input" value={ex.input} onChange={(e) => updateExample(i, "input", e.target.value)} />
                        <button type="button" className="icon-btn" onClick={() => removeExample(i)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="edit-row">
                        <input className="text-input mono" placeholder="Output" value={ex.output} onChange={(e) => updateExample(i, "output", e.target.value)} />
                      </div>
                      <div className="edit-row">
                        <input className="text-input" placeholder="Explanation (optional)" value={ex.explanation} onChange={(e) => updateExample(i, "explanation", e.target.value)} />
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="example-card">
                      <b>Example {i + 1}</b>
                      <div className="example-row">Input: {ex.input}</div>
                      <div className="example-row">Output: {ex.output}</div>
                      {ex.explanation && <div className="example-explain">{ex.explanation}</div>}
                    </div>
                  )
                )}

                <div className="section-title">
                  Constraints
                  {problemEdit && (
                    <button type="button" className="add-link" onClick={addConstraint}>
                      <Plus size={12} /> Add
                    </button>
                  )}
                </div>
                {problemEdit ? (
                  problem.constraints.map((c, i) => (
                    <div key={i} className="edit-row">
                      <input className="text-input mono" value={c} onChange={(e) => updateConstraint(i, e.target.value)} />
                      <button type="button" className="icon-btn" onClick={() => removeConstraint(i)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                ) : (
                  <ul className="constraints-list">
                    {problem.constraints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}

                <div className="section-title">Signature (JavaScript)</div>
                {problemEdit ? (
                  <div className="edit-row" style={{ marginBottom: 6 }}>
                    <input className="text-input mono" value={problem.jsSignature} onChange={(e) => setProblem((p) => ({ ...p, jsSignature: e.target.value }))} />
                  </div>
                ) : (
                  <div className="sig-chip">{problem.jsSignature}</div>
                )}
                {problemEdit && (
                  <button type="button" className="add-link" onClick={insertStub} style={{ marginTop: 8 }}>
                    <Pencil size={12} /> Insert stub into JS editor
                  </button>
                )}
                <p className="hint" style={{ marginTop: 10 }}>
                  Only JavaScript actually runs in the browser — Run and the console below use this signature to call your code.
                </p>
              </>
            ) : (
              <>
                {ledger.length === 0 ? (
                  <div className="empty-note">Nothing pushed yet this session.</div>
                ) : (
                  <table className="sub-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Path</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <span className="status-pill">Pushed</span>
                          </td>
                          <td>
                            {row.url ? (
                              <a href={row.url} target="_blank" rel="noreferrer">
                                {row.path}
                              </a>
                            ) : (
                              row.path
                            )}
                          </td>
                          <td>{timeAgo(row.time)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </aside>

        <main className="bench-main">
          <div className="toolbar">
            <div className="lang-dropdown" ref={langMenuRef}>
              <button type="button" className="lang-dropdown-btn" onClick={() => setLangMenuOpen((v) => !v)}>
                {LANG_CONFIG[activeLang].label}
                <ChevronDown size={13} />
              </button>
              {langMenuOpen && (
                <div className="lang-menu">
                  {LANG_ORDER.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`lang-menu-item${activeLang === key ? " active" : ""}`}
                      onClick={() => {
                        setActiveLang(key);
                        setLangMenuOpen(false);
                      }}
                    >
                      {LANG_CONFIG[key].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="toolbar-actions">
              {isRunnable && (
                <button type="button" className="run-btn" onClick={handleRun} disabled={running || testCases.length === 0}>
                  {running ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Play size={13} />}
                  Run
                </button>
              )}
              <button type="button" className="commit-btn" onClick={handleCommit} disabled={stage === "pushing"}>
                {stage === "pushing" ? (
                  <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} />
                ) : (
                  <GitCommit size={13} />
                )}
                {stage === "pushing" ? "Pushing…" : "Submit"}
              </button>
            </div>
          </div>

          <div className="ticket" style={{ position: "relative" }}>
            <input className="text-input" placeholder="Topic folder" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <input className="text-input mono" placeholder="File name" value={filename} onChange={(e) => setFilename(e.target.value)} />
            <span className="ticket-path">
              <b>
                {owner || "owner"}/{repo || "repo"}
              </b>{" "}
              · {branch || "main"} · {pathPreview}
            </span>
            {!showCommitMsg && (
              <button type="button" className="commit-msg-toggle" onClick={() => setShowCommitMsg(true)}>
                Add commit message
              </button>
            )}
            {showCommitMsg && (
              <input
                className="text-input"
                style={{ maxWidth: 200 }}
                placeholder={`Add ${slugify(topic || "topic")}/${sanitizeFilename(filename, ext)}.${ext}`}
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
              />
            )}
            <button type="button" className={`gear-btn${settingsOpen ? " open" : ""}`} onClick={() => setSettingsOpen((v) => !v)}>
              <Settings2 size={13} />
              GitHub
            </button>

            {settingsOpen && (
              <div className="settings-popover">
                <div className="field-group">
                  <span className="field-label">Personal access token</span>
                  <div className="token-row">
                    <input
                      className="text-input mono"
                      type={showToken ? "text" : "password"}
                      placeholder="ghp_…"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                    />
                    <button type="button" className="eye-btn" onClick={() => setShowToken((v) => !v)} aria-label={showToken ? "Hide token" : "Show token"}>
                      {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <span className="hint">Needs repo access. Not saved — re-enter it next time.</span>
                </div>
                <div className="field-group">
                  <span className="field-label">Repo owner</span>
                  <input className="text-input mono" placeholder="your-username" value={owner} onChange={(e) => setOwner(e.target.value)} />
                </div>
                <div className="field-group">
                  <span className="field-label">Repository</span>
                  <input className="text-input mono" placeholder="my-solutions" value={repo} onChange={(e) => setRepo(e.target.value)} />
                </div>
                <div className="field-group">
                  <span className="field-label">Branch</span>
                  <input className="text-input mono" placeholder="main" value={branch} onChange={(e) => setBranch(e.target.value)} />
                </div>
                <div className="field-group">
                  <span className="field-label">Root folder (optional)</span>
                  <input className="text-input mono" placeholder="e.g. solutions" value={rootFolder} onChange={(e) => setRootFolder(e.target.value)} />
                </div>
                <button type="button" className="verify-btn" onClick={verifyConnection}>
                  {connStatus === "checking" ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <FolderGit2 size={14} />}
                  Verify connection
                </button>
                {connStatus === "connected" && <span className="conn-msg ok">Connected as @{connUser}.</span>}
                {connStatus === "error" && connError && <span className="conn-msg err">{connError}</span>}
              </div>
            )}
          </div>

          {stage !== "idle" && (
            <div className={`push-banner ${stage}`}>
              {stage === "pushing" && (
                <>
                  <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} />
                  Pushing to GitHub…
                </>
              )}
              {stage === "success" && lastResult && (
                <>
                  <CheckCircle2 size={13} />
                  Filed at {lastResult.path}.
                  {lastResult.url && (
                    <a href={lastResult.url} target="_blank" rel="noreferrer">
                      View on GitHub
                    </a>
                  )}
                </>
              )}
              {stage === "error" && (
                <>
                  <AlertCircle size={13} />
                  {stageMessage}
                </>
              )}
            </div>
          )}

          <div className="editor-wrap">
            <div className="gutter" ref={gutterRef}>
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <div className="editor-layers">
              <pre className="highlight-layer" ref={highlightRef} aria-hidden="true">
                {tokens.map((t, i) => (
                  <span key={i} className={`tok-${t.type}`}>
                    {t.text}
                  </span>
                ))}
                {"\n"}
              </pre>
              <textarea
                ref={textareaRef}
                className="code-input"
                value={code}
                onChange={(e) => updateCode(e.target.value)}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label={`${LANG_CONFIG[activeLang].label} code editor`}
              />
            </div>
          </div>

          {isRunnable ? (
            <div className="console-panel">
              <div className="console-tabs">
                <button type="button" className={`ctab${consoleTab === "testcase" ? " active" : ""}`} onClick={() => setConsoleTab("testcase")}>
                  Testcase
                </button>
                <button type="button" className={`ctab${consoleTab === "result" ? " active" : ""}`} onClick={() => setConsoleTab("result")}>
                  Test Result
                </button>
              </div>

              {consoleTab === "testcase" ? (
                <>
                  <div className="tc-tabs">
                    {testCases.map((tc, i) => {
                      const r = testResults[tc.id];
                      const dotClass = r ? (r.status === "pass" ? "dot-ok" : "dot-err") : "";
                      return (
                        <button key={tc.id} type="button" className={`tc-tab${selectedTcId === tc.id ? " active" : ""}`} onClick={() => setSelectedTcId(tc.id)}>
                          {r && <span className={`dot ${dotClass}`} />}
                          Case {i + 1}
                        </button>
                      );
                    })}
                    <button type="button" className="tc-add" onClick={addTestCase} aria-label="Add test case">
                      <Plus size={13} />
                    </button>
                  </div>
                  {selectedTc && (
                    <div className="tc-detail">
                      <div className="tc-fields">
                        <div className="field-group">
                          <span className="field-label">Arguments</span>
                          <input className="text-input mono" placeholder="[2, 7, 11, 15], 9" value={selectedTc.input} onChange={(e) => updateTestCase(selectedTc.id, "input", e.target.value)} />
                        </div>
                        <div className="field-group">
                          <span className="field-label">Expected return</span>
                          <input className="text-input mono" placeholder="[0, 1]" value={selectedTc.expected} onChange={(e) => updateTestCase(selectedTc.id, "expected", e.target.value)} />
                        </div>
                      </div>
                      <button type="button" className="tc-remove" onClick={() => removeTestCase(selectedTc.id)}>
                        <Trash2 size={12} /> Remove case
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="result-content">
                  {overallStatus === null && <p className="hint">Hit Run to check your code against the test cases.</p>}
                  {overallStatus === "accepted" && (
                    <div className="status-banner accepted">
                      <CheckCircle2 size={16} /> Accepted
                    </div>
                  )}
                  {overallStatus === "wrong" && (
                    <div className="status-banner wrong">
                      <XCircle size={16} /> Wrong Answer
                    </div>
                  )}
                  {overallStatus === "error" && (
                    <div className="status-banner error">
                      <AlertCircle size={16} /> Runtime Error
                    </div>
                  )}
                  {testCases.map((tc, i) => {
                    const r = testResults[tc.id];
                    if (!r) return null;
                    return (
                      <div key={tc.id} className="case-result">
                        <div className={`case-result-head ${r.status}`}>
                          {r.status === "pass" && <CheckCircle2 size={13} />}
                          {r.status === "fail" && <XCircle size={13} />}
                          {r.status === "error" && <AlertCircle size={13} />}
                          Case {i + 1} — {r.status === "pass" ? "Passed" : r.status === "fail" ? "Failed" : "Error"}
                        </div>
                        <div className="case-result-row">Input: {tc.input}</div>
                        {r.status !== "error" ? (
                          <>
                            <div className="case-result-row">Output: {formatValue(r.actual)}</div>
                            <div className="case-result-row">Expected: {tc.expected}</div>
                          </>
                        ) : (
                          <div className="case-result-row">{r.error}</div>
                        )}
                        {r.ms !== null && r.ms !== undefined && (
                          <div className="case-result-time">~{r.ms.toFixed(2)}ms in this browser</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="run-note">
              Execution isn't available for {LANG_CONFIG[activeLang].label} in the browser — Submit saves your code
              directly, without a test gate.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}