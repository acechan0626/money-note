/**
 * 記帳小工具 (Money Note)
 * 遵循 SPEC.md 與 ACCEPTANCE.md 規範
 */

// LocalStorage 鍵值常數（依 SPEC.md 第 5 節）
const STORAGE_KEY_RECORDS = 'money_note_records';
const STORAGE_KEY_BUDGET = 'money_note_budget';
const DEFAULT_BUDGET = 6000;

// 狀態管理
let records = [];
let budget = DEFAULT_BUDGET;

// DOM 元素快取
const currentMonthBadge = document.getElementById('currentMonthBadge');
const currentMonthText = document.getElementById('currentMonthText');

// 總預算卡元素
const totalExpenseDisplay = document.getElementById('totalExpenseDisplay');
const budgetDisplay = document.getElementById('budgetDisplay');
const remainingLabel = document.getElementById('remainingLabel');
const remainingAmountDisplay = document.getElementById('remainingAmountDisplay');
const progressBarFill = document.getElementById('progressBarFill');
const progressBarTrack = document.getElementById('progressBarTrack');
const budgetProgressPercent = document.getElementById('budgetProgressPercent');
const overbudgetBadge = document.getElementById('overbudgetBadge');

// 預算修改面板
const editBudgetBtn = document.getElementById('editBudgetBtn');
const budgetEditorPanel = document.getElementById('budgetEditorPanel');
const budgetInput = document.getElementById('budgetInput');
const saveBudgetBtn = document.getElementById('saveBudgetBtn');
const cancelBudgetBtn = document.getElementById('cancelBudgetBtn');
const budgetInputError = document.getElementById('budgetInputError');

// 飲食專屬卡元素
const foodExpenseDisplay = document.getElementById('foodExpenseDisplay');
const foodExpenseRatio = document.getElementById('foodExpenseRatio');

// 表單元素
const expenseForm = document.getElementById('expenseForm');
const expenseDateInput = document.getElementById('expenseDate');
const expenseNameInput = document.getElementById('expenseName');
const expenseAmountInput = document.getElementById('expenseAmount');
const expenseCategorySelect = document.getElementById('expenseCategory');
const nameError = document.getElementById('nameError');
const amountError = document.getElementById('amountError');

// 清單元素
const recordList = document.getElementById('recordList');
const recordCount = document.getElementById('recordCount');
const emptyState = document.getElementById('emptyState');

/**
 * 取得當天日期字串（YYYY-MM-DD）
 */
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 取得當前年月字串（YYYY-MM）
 */
function getCurrentYearMonth() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 從 localStorage 載入資料
 */
function loadState() {
  // 載入花費紀錄
  try {
    const savedRecords = localStorage.getItem(STORAGE_KEY_RECORDS);
    if (savedRecords) {
      records = JSON.parse(savedRecords);
      if (!Array.isArray(records)) {
        records = [];
      }
    } else {
      records = [];
    }
  } catch (err) {
    console.error('載入花費紀錄失敗：', err);
    records = [];
  }

  // 載入生活費預算設定
  try {
    const savedBudget = localStorage.getItem(STORAGE_KEY_BUDGET);
    if (savedBudget !== null && !isNaN(Number(savedBudget)) && Number(savedBudget) > 0) {
      budget = Number(savedBudget);
    } else {
      budget = DEFAULT_BUDGET;
    }
  } catch (err) {
    console.error('載入預算設定失敗：', err);
    budget = DEFAULT_BUDGET;
  }
}

/**
 * 將資料持久化至 localStorage
 */
function saveRecords() {
  localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
}

function saveBudget(newBudget) {
  budget = newBudget;
  localStorage.setItem(STORAGE_KEY_BUDGET, budget.toString());
}

/**
 * 清單排序演算法（依據 SPEC.md 第 4 節規範）：
 * 1. 列表嚴格依「花費日期（Date）」由新至舊排序（較新的排在上方）。
 * 2. 若兩筆花費日期相同，則依「輸入建立時間（id Timestamp）」由新至舊排序（後輸入的排在上方）。
 */
function getSortedRecords() {
  return [...records].sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return Number(b.id) - Number(a.id);
  });
}

/**
 * 更新頂部儀表板統計數據
 */
function updateDashboard() {
  const currentYM = getCurrentYearMonth();
  
  // 篩選當月份紀錄（依 SPEC.md 規則：僅計算當前西元年與當前月份之花費）
  const currentMonthRecords = records.filter(r => r.date && r.date.startsWith(currentYM));

  // 本月總支出
  const totalExpense = currentMonthRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  // 本月飲食花費（篩選分類為「飲食」）
  const foodExpense = currentMonthRecords
    .filter(r => r.category === '飲食')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  // 1. 更新總支出顯示
  totalExpenseDisplay.textContent = `$${totalExpense.toLocaleString()}`;
  budgetDisplay.textContent = `$${budget.toLocaleString()}`;

  // 2. 預算進度與超支計算
  const progressRatio = budget > 0 ? (totalExpense / budget) * 100 : 0;
  // 格式化進度百分比，最多保留一位小數
  const formattedProgress = Math.round(progressRatio * 10) / 10;
  budgetProgressPercent.textContent = `已使用 ${formattedProgress}%`;

  // 進度條寬度最多 100%
  const barWidth = Math.min(100, Math.max(0, progressRatio));
  progressBarFill.style.width = `${barWidth}%`;
  progressBarTrack.setAttribute('aria-valuenow', Math.round(barWidth).toString());

  // 判斷是否超支 (嚴格大於預算時才觸發紅色超支警示)
  if (totalExpense > budget) {
    const overAmount = totalExpense - budget;
    progressBarFill.classList.add('is-overbudget');
    overbudgetBadge.style.display = 'inline-flex';
    overbudgetBadge.textContent = `已超支 $${overAmount.toLocaleString()}`;
    remainingLabel.textContent = '已超支額度';
    remainingAmountDisplay.textContent = `-$${overAmount.toLocaleString()}`;
    remainingAmountDisplay.style.color = 'var(--color-danger)';
  } else {
    const remaining = budget - totalExpense;
    progressBarFill.classList.remove('is-overbudget');
    overbudgetBadge.style.display = 'none';
    remainingLabel.textContent = '剩餘生活費';
    remainingAmountDisplay.textContent = `$${remaining.toLocaleString()}`;
    remainingAmountDisplay.style.color = '';
  }

  // 3. 飲食專屬卡更新
  foodExpenseDisplay.textContent = `$${foodExpense.toLocaleString()}`;
  const foodRatio = budget > 0 ? (foodExpense / budget) * 100 : 0;
  const formattedFoodRatio = Math.round(foodRatio * 10) / 10;
  foodExpenseRatio.textContent = `佔生活費 ${formattedFoodRatio}%`;
}

/**
 * 渲染支出清單
 */
function renderList() {
  const sorted = getSortedRecords();
  recordCount.textContent = `共 ${sorted.length} 筆`;

  if (sorted.length === 0) {
    emptyState.style.display = 'flex';
    recordList.innerHTML = '';
    return;
  }

  emptyState.style.display = 'none';
  recordList.innerHTML = sorted.map(item => {
    return `
      <li class="record-item" data-id="${item.id}">
        <div class="record-left-group">
          <span class="record-date-badge">${escapeHtml(item.date)}</span>
          <span class="record-category-tag" data-cat="${escapeHtml(item.category)}">${escapeHtml(item.category)}</span>
          <span class="record-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
        </div>
        <div class="record-right-group">
          <span class="record-amount">$${Number(item.amount).toLocaleString()}</span>
          <button type="button" class="record-delete-btn" data-action="delete" data-id="${item.id}" title="刪除這筆紀錄" aria-label="刪除 ${escapeHtml(item.name)}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              <line x1="10" x2="10" y1="11" y2="17"/>
              <line x1="14" x2="14" y1="11" y2="17"/>
            </svg>
          </button>
        </div>
      </li>
    `;
  }).join('');
}

/**
 * 簡易 HTML 跳脫防護
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 完整刷新 UI
 */
function render() {
  updateDashboard();
  renderList();
}

/**
 * 表單防呆驗證與處理
 */
function handleFormSubmit(e) {
  e.preventDefault();

  // 清除錯誤提示
  let hasError = false;
  nameError.classList.remove('show');
  expenseNameInput.classList.remove('has-error');
  amountError.classList.remove('show');
  expenseAmountInput.parentElement.classList.remove('has-error');

  const rawName = expenseNameInput.value;
  const trimmedName = rawName.trim();
  const rawAmount = expenseAmountInput.value.trim();
  const amount = Number(rawAmount);
  const date = expenseDateInput.value;
  const category = expenseCategorySelect.value;

  // 1. 項目名稱防呆：去除前後空白後為空字串，禁止新增
  if (!trimmedName) {
    nameError.classList.add('show');
    expenseNameInput.classList.add('has-error');
    hasError = true;
  }

  // 2. 金額防呆（符合 K4）：金額空白、0、負數或非數字，禁止新增
  if (rawAmount === '' || isNaN(amount) || amount <= 0) {
    amountError.classList.add('show');
    expenseAmountInput.parentElement.classList.add('has-error');
    hasError = true;
  }

  // 若防呆未通過，終止處理
  if (hasError) {
    return;
  }

  // 新增紀錄物件
  const newRecord = {
    id: Date.now().toString(),
    date: date || getTodayString(),
    name: trimmedName,
    amount: amount,
    category: category || '飲食'
  };

  records.push(newRecord);
  saveRecords();

  // 清空表單欄位，日期維持今天，分類重設為「飲食」
  expenseNameInput.value = '';
  expenseAmountInput.value = '';
  expenseDateInput.value = getTodayString();
  expenseCategorySelect.value = '飲食';

  // 重新渲染畫面
  render();
}

/**
 * 處理清單點擊（刪除紀錄）
 */
function handleListClick(e) {
  const deleteBtn = e.target.closest('[data-action="delete"]');
  if (!deleteBtn) return;

  const id = deleteBtn.getAttribute('data-id');
  if (!id) return;

  // 移除該筆紀錄
  records = records.filter(r => r.id !== id);
  saveRecords();
  render();
}

/**
 * 預算編輯相關互動
 */
function setupBudgetEditor() {
  editBudgetBtn.addEventListener('click', () => {
    budgetEditorPanel.style.display = 'block';
    budgetInput.value = budget;
    budgetInputError.classList.remove('show');
    budgetInput.focus();
  });

  cancelBudgetBtn.addEventListener('click', () => {
    budgetEditorPanel.style.display = 'none';
  });

  saveBudgetBtn.addEventListener('click', () => {
    const val = Number(budgetInput.value);
    if (!val || isNaN(val) || val <= 0) {
      budgetInputError.classList.add('show');
      return;
    }
    budgetInputError.classList.remove('show');
    saveBudget(val);
    budgetEditorPanel.style.display = 'none';
    render();
  });
}

/**
 * 即時清除表單錯誤狀態監聽
 */
function setupInputListeners() {
  expenseNameInput.addEventListener('input', () => {
    if (expenseNameInput.value.trim()) {
      nameError.classList.remove('show');
      expenseNameInput.classList.remove('has-error');
    }
  });

  expenseAmountInput.addEventListener('input', () => {
    const val = Number(expenseAmountInput.value);
    if (!isNaN(val) && val > 0) {
      amountError.classList.remove('show');
      expenseAmountInput.parentElement.classList.remove('has-error');
    }
  });
}

/**
 * 初始化應用程式
 */
function init() {
  loadState();

  // 預設日期為當天
  expenseDateInput.value = getTodayString();

  // 設定當月徽章文字
  const d = new Date();
  currentMonthText.textContent = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;

  // 綁定事件
  expenseForm.addEventListener('submit', handleFormSubmit);
  recordList.addEventListener('click', handleListClick);
  setupBudgetEditor();
  setupInputListeners();

  // 首次渲染
  render();
}

// 頁面載入完成後啟動
document.addEventListener('DOMContentLoaded', init);
