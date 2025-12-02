import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Calculator, 
  BarChart3, 
  Save, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  Activity,
  Settings,
  Plus,
  Briefcase,
  Edit3,
  Clock,
  DollarSign
} from 'lucide-react';

// --- 全域常數 ---
const GLOBAL_CONSTANTS = {
  MEAL_ALLOWANCE: 3000,  // 正職伙食津貼 (兼職通常無)
};

// --- 預設資料 ---
const DEFAULT_JOB_ROLES = [
  {
    id: 'nurse_fulltime',
    name: '勞工健康服務護理師 (正職)',
    type: 'fulltime',     // 新增：職務類型
    baseSalary: 28590,    
    baseQuota: 5,         
    overQuotaRate: 1200,  
    newCaseBonus: 3000,   
    levelAllowances: { 'C': 0, 'B': 3000, 'A': 6000 }
  },
  {
    id: 'nurse_parttime',
    name: '特約護理師 (兼職)',
    type: 'parttime',     // 新增：職務類型
    hourlyRate: 600,      // 時薪
    hoursPerCase: 2,      // 每場時數
    newCaseBonus: 3000,
    // 兼職通常無職等津貼，但保留欄位結構以免報錯，設為0
    levelAllowances: { 'C': 0, 'B': 0, 'A': 0 }
  }
];

const DEFAULT_KPI_DEFINITIONS = [
  { id: 'hard_rate', label: '臨場服務達成率', maxScore: 30, category: 'quantitative', placeholder: '' },
  { id: 'hard_report', label: '報告繳交時效', maxScore: 25, category: 'quantitative', placeholder: '遲交每份扣 5 分' },
  { id: 'hard_train', label: '教育訓練時數', maxScore: 15, category: 'quantitative', placeholder: '' },
  { id: 'soft_client', label: '客戶滿意度', maxScore: 15, category: 'qualitative', placeholder: '' },
  { id: 'soft_admin', label: '行政配合度', maxScore: 10, category: 'qualitative', placeholder: '' },
  { id: 'soft_image', label: '專業形象', maxScore: 5, category: 'qualitative', placeholder: '' },
];

// --- 勞健保計算 ---
const calculateInsurance = (totalSalary, employmentType, baseSalary = 0) => {
  // 兼職(部分工時)勞保級距下限較低 (2024年為11,100)
  // 正職下限為基本工資 (27,470)
  const minInsured = employmentType === 'parttime' ? 11100 : Math.max(baseSalary, 27470);
  
  let insuredSalary = Math.ceil(totalSalary / 1000) * 1000;
  if (insuredSalary < minInsured) insuredSalary = minInsured;
  
  // 級距上限
  const laborSalaryCap = Math.min(insuredSalary, 45800); 
  const laborRate = 0.12; 
  // 勞保
  const laborEmp = Math.round(laborSalaryCap * laborRate * 0.2);
  const laborComp = Math.round(laborSalaryCap * laborRate * 0.7);

  // 健保 (兼職若每週工時低於12小時可能不需在公司投保，此處假設皆投保)
  const healthRate = 0.0517;
  const healthEmp = Math.round(insuredSalary * healthRate * 0.3);
  const healthComp = Math.round(insuredSalary * healthRate * 0.6 * 1.58);

  // 勞退
  const pensionSalaryCap = Math.min(insuredSalary, 150000); 
  const pensionComp = Math.round(pensionSalaryCap * 0.06);

  return {
    insuredSalary,
    labor: { emp: laborEmp, comp: laborComp },
    health: { emp: healthEmp, comp: healthComp },
    pension: { comp: pensionComp },
    totalEmpCost: laborEmp + healthEmp,
    totalCompCost: laborComp + healthComp + pensionComp
  };
};

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-lg shadow-md border border-gray-200 ${className}`}>
    {children}
  </div>
);

const KPIInput = ({ label, maxScore, value, onChange, placeholder }) => (
  <div className="mb-4">
    <div className="flex justify-between mb-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <span className="text-sm text-gray-500">{value} / {maxScore} 分</span>
    </div>
    <input 
      type="range" 
      min="0" 
      max={maxScore} 
      value={value} 
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
    />
    {placeholder && <p className="text-xs text-gray-400 mt-1">{placeholder}</p>}
  </div>
);

export default function PayrollApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // --- 自動樣式修復 (Auto Style Fix) ---
  // 這段 useEffect 會在元件載入時檢查是否有 Tailwind CSS
  // 如果沒有 (例如本地安裝失敗)，它會自動從 CDN 載入，確保畫面漂亮
  useEffect(() => {
    if (!document.querySelector('script[src^="https://cdn.tailwindcss.com"]')) {
      const script = document.createElement('script');
      script.src = "https://cdn.tailwindcss.com";
      // 防止 CDN 與本地樣式衝突，但在純 CDN 模式下無影響
      document.head.appendChild(script);
    }
  }, []);

  const [jobRoles, setJobRoles] = useState(() => {
    const saved = localStorage.getItem('jobRoles');
    return saved ? JSON.parse(saved) : DEFAULT_JOB_ROLES;
  });

  const [employees, setEmployees] = useState(() => {
    const saved = localStorage.getItem('employees');
    const initialData = saved ? JSON.parse(saved) : [
      { id: 1, name: '謝佩君', level: 'C', title: '護理師', roleId: 'nurse_fulltime' },
    ];
    // 兼容舊資料
    return initialData.map(emp => emp.roleId ? emp : { ...emp, roleId: 'nurse_fulltime' });
  });
  
  const [records, setRecords] = useState(() => {
    const saved = localStorage.getItem('records');
    return saved ? JSON.parse(saved) : [];
  });

  const [kpiDefinitions, setKpiDefinitions] = useState(() => {
    const saved = localStorage.getItem('kpiDefinitions');
    return saved ? JSON.parse(saved) : DEFAULT_KPI_DEFINITIONS;
  });

  const [currentSlip, setCurrentSlip] = useState({
    empId: '',
    month: new Date().toISOString().slice(0, 7), 
    cases: '', 
    newCases: '', 
    penaltyPoints: '', 
    kpi: {} 
  });

  const [editingRole, setEditingRole] = useState(null);

  useEffect(() => { localStorage.setItem('employees', JSON.stringify(employees)); }, [employees]);
  useEffect(() => { localStorage.setItem('records', JSON.stringify(records)); }, [records]);
  useEffect(() => { localStorage.setItem('kpiDefinitions', JSON.stringify(kpiDefinitions)); }, [kpiDefinitions]);
  useEffect(() => { localStorage.setItem('jobRoles', JSON.stringify(jobRoles)); }, [jobRoles]);

  useEffect(() => {
    setCurrentSlip(prev => {
      const newKpi = { ...prev.kpi };
      kpiDefinitions.forEach(def => {
        if (newKpi[def.id] === undefined) {
          newKpi[def.id] = def.maxScore; 
        }
      });
      return { ...prev, kpi: newKpi };
    });
  }, [kpiDefinitions]);

  // --- 核心計算邏輯 ---
  const calculatedResult = useMemo(() => {
    if (!currentSlip.empId) return null;
    const emp = employees.find(e => e.id === parseInt(currentSlip.empId));
    if (!emp) return null;

    const roleConfig = jobRoles.find(r => r.id === emp.roleId) || jobRoles[0];
    const isPartTime = roleConfig.type === 'parttime';

    const numCases = Number(currentSlip.cases) || 0;
    const numNewCases = Number(currentSlip.newCases) || 0;
    const numPenaltyPoints = Number(currentSlip.penaltyPoints) || 0;

    let baseTotal = 0;
    let positionAllowance = 0;
    let performanceBonus = 0;
    let businessBonus = 0;

    if (isPartTime) {
      // --- 兼職計算 ---
      // 公式：場次 * 每場時數 * 時薪
      const hoursPerCase = roleConfig.hoursPerCase || 2;
      const hourlyRate = roleConfig.hourlyRate || 0;
      performanceBonus = numCases * hoursPerCase * hourlyRate; // 兼職的「服務費」視為變動薪資
      baseTotal = 0; // 兼職無底薪
      positionAllowance = 0; // 兼職通常無職等津貼
    } else {
      // --- 正職計算 ---
      baseTotal = parseInt(roleConfig.baseSalary) + GLOBAL_CONSTANTS.MEAL_ALLOWANCE;
      positionAllowance = roleConfig.levelAllowances[emp.level] !== undefined 
        ? parseInt(roleConfig.levelAllowances[emp.level]) 
        : 0;
      
      let bonusCases = Math.max(0, numCases - roleConfig.baseQuota);
      performanceBonus = bonusCases * roleConfig.overQuotaRate;
    }

    businessBonus = numNewCases * roleConfig.newCaseBonus;

    // 扣點機制
    let penaltyStatus = '正常';
    let bonusDiscount = 1; 
    
    if (numPenaltyPoints >= 5) {
      penaltyStatus = '紅牌 (獎金取消)';
      bonusDiscount = 0;
    } else if (numPenaltyPoints >= 3) {
      penaltyStatus = '黃牌 (獎金八折)';
      bonusDiscount = 0.8;
    }

    // 兼職的服務費是否受紅黃牌影響？
    // 假設「服務費」即「績效」，若表現太差依紅黃牌打折是合理的管理手段
    const finalPerformanceBonus = performanceBonus * bonusDiscount;
    const totalBonus = finalPerformanceBonus + businessBonus;

    let kpiScore = 0;
    let maxPossibleScore = 0;
    kpiDefinitions.forEach(def => {
      const score = currentSlip.kpi[def.id] !== undefined ? currentSlip.kpi[def.id] : 0;
      kpiScore += score;
      maxPossibleScore += def.maxScore;
    });

    const kpiStatus = kpiScore < 70 ? '不及格 (需輔導)' : '及格';
    const grossSalary = baseTotal + positionAllowance + totalBonus;
    
    // 勞健保 (兼職與正職級距不同)
    const insurance = calculateInsurance(grossSalary, roleConfig.type, roleConfig.baseSalary);
    const netSalary = grossSalary - insurance.totalEmpCost;

    return {
      emp,
      roleConfig,
      isPartTime,
      baseTotal,
      positionAllowance,
      performanceBonus, 
      finalPerformanceBonus,
      businessBonus,
      totalBonus,
      grossSalary,
      netSalary,
      insurance,
      penaltyStatus,
      kpiScore,
      maxPossibleScore,
      kpiStatus,
      cleanData: {
        cases: numCases,
        newCases: numNewCases,
        penaltyPoints: numPenaltyPoints
      }
    };
  }, [currentSlip, employees, kpiDefinitions, jobRoles]);

  const handleNumChange = (field, value) => {
    const val = value;
    if (val === '' || !isNaN(val)) {
        setCurrentSlip(prev => ({ ...prev, [field]: val }));
    }
  };

  const handleKpiScoreChange = (id, value) => {
    setCurrentSlip(prev => ({
      ...prev,
      kpi: { ...prev.kpi, [id]: value }
    }));
  };

  const handleSaveRecord = () => {
    if (!calculatedResult) return;
    const newRecord = {
      id: Date.now(),
      empId: parseInt(currentSlip.empId),
      month: currentSlip.month,
      roleType: calculatedResult.roleConfig.type, // 儲存時記錄類型，方便統計
      data: { 
        ...currentSlip,
        cases: calculatedResult.cleanData.cases,
        newCases: calculatedResult.cleanData.newCases,
        penaltyPoints: calculatedResult.cleanData.penaltyPoints
      },
      result: { 
        grossSalary: calculatedResult.grossSalary,
        netSalary: calculatedResult.netSalary,
        kpiScore: calculatedResult.kpiScore,
        compCost: calculatedResult.insurance.totalCompCost
      }
    };
    
    const filtered = records.filter(r => !(r.empId === newRecord.empId && r.month === newRecord.month));
    setRecords([...filtered, newRecord]);
    
    setTimeout(() => {
        alert(`✅ 資料已儲存成功！\n\n員工：${calculatedResult.emp.name}\n類型：${calculatedResult.isPartTime ? '兼職' : '正職'}\n實領薪資：$${calculatedResult.netSalary.toLocaleString()}`);
    }, 100);
  };

  const handleDeleteRecord = (id) => {
    if(confirm('確定刪除此筆紀錄？')) setRecords(records.filter(r => r.id !== id));
  };

  const handleAddEmployee = (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    const roleId = e.target.roleId.value;
    const level = e.target.level.value;
    const title = e.target.title.value;
    setEmployees([...employees, { id: Date.now(), name, roleId, level, title }]);
    e.target.reset();
  };

  const handleDeleteEmployee = (id) => {
      if(confirm('確定刪除員工？')) setEmployees(employees.filter(e => e.id !== id));
  }

  const handleSaveRole = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const type = formData.get('type');
    
    const newRole = {
      id: editingRole ? editingRole.id : `role_${Date.now()}`,
      name: formData.get('name'),
      type: type,
      newCaseBonus: parseInt(formData.get('newCaseBonus')) || 0,
      // 正職欄位
      baseSalary: type === 'fulltime' ? parseInt(formData.get('baseSalary')) : 0,
      baseQuota: type === 'fulltime' ? parseInt(formData.get('baseQuota')) : 0,
      overQuotaRate: type === 'fulltime' ? parseInt(formData.get('overQuotaRate')) : 0,
      levelAllowances: {
        'C': type === 'fulltime' ? parseInt(formData.get('level_C')) : 0,
        'B': type === 'fulltime' ? parseInt(formData.get('level_B')) : 0,
        'A': type === 'fulltime' ? parseInt(formData.get('level_A')) : 0,
      },
      // 兼職欄位
      hourlyRate: type === 'parttime' ? parseInt(formData.get('hourlyRate')) : 0,
      hoursPerCase: type === 'parttime' ? parseInt(formData.get('hoursPerCase')) : 0,
    };

    if (editingRole) {
      setJobRoles(jobRoles.map(r => r.id === newRole.id ? newRole : r));
      setEditingRole(null);
    } else {
      setJobRoles([...jobRoles, newRole]);
    }
    e.target.reset();
  };

  const handleDeleteRole = (id) => {
    if (jobRoles.length <= 1) {
      alert("至少需保留一個職務類別！");
      return;
    }
    if (employees.some(e => e.roleId === id)) {
      alert("尚有員工屬於此職務類別，無法刪除。");
      return;
    }
    if(confirm('確定刪除此職務設定？')) setJobRoles(jobRoles.filter(r => r.id !== id));
  };

  const handleAddKpi = (e) => {
    e.preventDefault();
    const label = e.target.label.value;
    const maxScore = parseInt(e.target.maxScore.value);
    const category = e.target.category.value;
    const placeholder = e.target.placeholder.value;
    const newKpi = { id: `custom_${Date.now()}`, label, maxScore, category, placeholder };
    setKpiDefinitions([...kpiDefinitions, newKpi]);
    e.target.reset();
  };

  const handleDeleteKpi = (id) => {
    if (confirm('確定刪除此考核項目？')) setKpiDefinitions(kpiDefinitions.filter(k => k.id !== id));
  };

  // --- Render ---
  const renderContent = () => {
    if (activeTab === 'dashboard') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthRecords = records.filter(r => r.month === currentMonth);
      
      const fullTimeRecords = monthRecords.filter(r => r.roleType !== 'parttime');
      const partTimeRecords = monthRecords.filter(r => r.roleType === 'parttime');

      const fullTimePayout = fullTimeRecords.reduce((sum, r) => sum + r.result.grossSalary, 0);
      const partTimePayout = partTimeRecords.reduce((sum, r) => sum + r.result.grossSalary, 0);
      const totalPayout = fullTimePayout + partTimePayout;

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 bg-blue-50 border-blue-200">
              <h3 className="text-gray-500 text-sm font-medium">本月總發放薪資 (預估)</h3>
              <p className="text-3xl font-bold text-blue-700 mt-2">${totalPayout.toLocaleString()}</p>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="text-blue-600 bg-blue-100 px-2 py-1 rounded">正職: ${fullTimePayout.toLocaleString()}</span>
                <span className="text-teal-600 bg-teal-100 px-2 py-1 rounded">兼職: ${partTimePayout.toLocaleString()}</span>
              </div>
            </Card>
            <Card className="p-6 bg-green-50 border-green-200">
              <h3 className="text-gray-500 text-sm font-medium">已結算人數</h3>
              <div className="flex items-baseline gap-2 mt-2">
                 <span className="text-3xl font-bold text-green-700">{monthRecords.length}</span>
                 <span className="text-sm text-gray-500">/ {employees.length} 人</span>
              </div>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="text-green-800">正職: {fullTimeRecords.length}</span>
                <span className="text-green-800">兼職: {partTimeRecords.length}</span>
              </div>
            </Card>
             <Card className="p-6 bg-purple-50 border-purple-200">
              <h3 className="text-gray-500 text-sm font-medium">平均每人產值 (薪資)</h3>
              <p className="text-3xl font-bold text-purple-700 mt-2">
                ${monthRecords.length ? Math.round(totalPayout / monthRecords.length).toLocaleString() : 0}
              </p>
              <p className="text-xs text-gray-500 mt-1">含正職與兼職</p>
            </Card>
          </div>
          
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            <Activity className="w-5 h-5 mr-2" /> 近期計算紀錄
          </h3>
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-700 font-bold">
                <tr>
                  <th className="px-6 py-3">月份</th>
                  <th className="px-6 py-3">類型</th>
                  <th className="px-6 py-3">姓名 (職務)</th>
                  <th className="px-6 py-3">場次</th>
                  <th className="px-6 py-3">KPI</th>
                  <th className="px-6 py-3">應發薪資</th>
                  <th className="px-6 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {records.sort((a,b) => b.month.localeCompare(a.month)).map(record => {
                  const emp = employees.find(e => e.id === record.empId);
                  const roleName = jobRoles.find(r => r.id === emp?.roleId)?.name || '未知';
                  const isPT = record.roleType === 'parttime';
                  return (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">{record.month}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${isPT ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'}`}>
                            {isPT ? '兼職' : '正職'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {emp ? `${emp.name}` : '已離職'} 
                        <span className="text-xs text-gray-500 block">{roleName}</span>
                      </td>
                      <td className="px-6 py-3">{record.data.cases}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${record.result.kpiScore >= 70 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {record.result.kpiScore}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-medium">${record.result.grossSalary.toLocaleString()}</td>
                      <td className="px-6 py-3">
                        <button onClick={() => handleDeleteRecord(record.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activeTab === 'calculator') {
      const quantitativeKpis = kpiDefinitions.filter(k => k.category === 'quantitative');
      const qualitativeKpis = kpiDefinitions.filter(k => k.category === 'qualitative');

      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <Calculator className="w-5 h-5 mr-2" /> 1. 基本資料輸入
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">選擇員工</label>
                  <select 
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                    value={currentSlip.empId}
                    onChange={(e) => setCurrentSlip({...currentSlip, empId: e.target.value})}
                  >
                    <option value="">請選擇...</option>
                    {employees.map(e => {
                       const role = jobRoles.find(r => r.id === e.roleId);
                       const typeLabel = role?.type === 'parttime' ? '(兼職)' : '(正職)';
                       return (
                        <option key={e.id} value={e.id}>{e.name} {typeLabel}</option>
                       );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">計算月份</label>
                  <input 
                    type="month" 
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                    value={currentSlip.month}
                    onChange={(e) => setCurrentSlip({...currentSlip, month: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">臨場場次</label>
                  <input 
                    type="number" 
                    min="0"
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                    value={currentSlip.cases}
                    onChange={(e) => handleNumChange('cases', e.target.value)}
                  />
                  {calculatedResult && (
                    <p className="text-xs text-blue-600 mt-1">
                      {calculatedResult.isPartTime ? 
                        `時薪$${calculatedResult.roleConfig.hourlyRate} × ${calculatedResult.roleConfig.hoursPerCase}hr` : 
                        `責任額: ${calculatedResult.roleConfig.baseQuota}場`}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">新開發案件</label>
                  <input 
                    type="number" 
                    min="0"
                    className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
                    value={currentSlip.newCases}
                    onChange={(e) => handleNumChange('newCases', e.target.value)}
                  />
                  {calculatedResult && (
                    <p className="text-xs text-blue-600 mt-1">單價: ${calculatedResult.roleConfig.newCaseBonus}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-600 mb-1">違規扣點</label>
                  <input 
                    type="number" 
                    min="0"
                    className="w-full border-red-300 text-red-600 rounded-md shadow-sm p-2 border"
                    value={currentSlip.penaltyPoints}
                    onChange={(e) => handleNumChange('penaltyPoints', e.target.value)}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" /> 2. 績效考核 (KPI)
              </h3>
              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-md mb-2">
                  <h4 className="font-bold text-blue-800 text-sm mb-2">定量指標 (直接影響獎金)</h4>
                  {quantitativeKpis.map(kpi => (
                    <KPIInput 
                      key={kpi.id}
                      label={`${kpi.label} (Max ${kpi.maxScore})`} 
                      maxScore={kpi.maxScore} 
                      value={currentSlip.kpi[kpi.id] !== undefined ? currentSlip.kpi[kpi.id] : kpi.maxScore} 
                      onChange={(v) => handleKpiScoreChange(kpi.id, v)} 
                      placeholder={kpi.placeholder}
                    />
                  ))}
                </div>
                <div className="bg-green-50 p-3 rounded-md">
                  <h4 className="font-bold text-green-800 text-sm mb-2">定性指標 (影響津貼/年終)</h4>
                  {qualitativeKpis.map(kpi => (
                    <KPIInput 
                      key={kpi.id}
                      label={`${kpi.label} (Max ${kpi.maxScore})`} 
                      maxScore={kpi.maxScore} 
                      value={currentSlip.kpi[kpi.id] !== undefined ? currentSlip.kpi[kpi.id] : kpi.maxScore} 
                      onChange={(v) => handleKpiScoreChange(kpi.id, v)} 
                      placeholder={kpi.placeholder}
                    />
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            {calculatedResult ? (
              <>
                <Card className={`p-6 border-t-4 ${calculatedResult.isPartTime ? 'border-t-teal-500' : 'border-t-blue-600'}`}>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">薪資試算單</h3>
                      <p className="text-sm text-gray-500">
                        {calculatedResult.roleConfig.name} 
                        {calculatedResult.isPartTime && <span className="ml-2 bg-teal-100 text-teal-800 text-xs px-2 py-0.5 rounded">兼職</span>}
                      </p>
                    </div>
                    <span className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-600">{currentSlip.month}</span>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                    {/* 正職專屬欄位 */}
                    {!calculatedResult.isPartTime && (
                      <>
                        <div className="flex justify-between text-gray-700">
                          <span>職等津貼 ({calculatedResult.emp.level}級)</span>
                          <span>${calculatedResult.positionAllowance.toLocaleString()}</span>
                        </div>
                        <div className="border-b border-gray-100 my-2"></div>
                        <div className="flex justify-between font-medium">
                          <span>固定薪資 (底薪+伙食)</span>
                          <span>${calculatedResult.baseTotal.toLocaleString()}</span>
                        </div>
                      </>
                    )}

                    {/* 變動獎金 (兼職的主要收入) */}
                    <div className="flex justify-between items-center">
                      <span>
                        {calculatedResult.isPartTime ? '臨場服務費 (場次×時數×時薪)' : '變動績效獎金'}
                        <span className="text-xs text-gray-400 ml-1 block md:inline">
                          {calculatedResult.isPartTime 
                            ? `(${calculatedResult.cleanData.cases}場 × ${calculatedResult.roleConfig.hoursPerCase}hr × $${calculatedResult.roleConfig.hourlyRate})`
                            : `(超額 ${Math.max(0, calculatedResult.cleanData.cases - calculatedResult.roleConfig.baseQuota)}場 × $${calculatedResult.roleConfig.overQuotaRate})`
                          }
                        </span>
                      </span>
                      <span className={calculatedResult.penaltyStatus.includes('紅') ? 'text-red-500 line-through' : ''}>
                        ${calculatedResult.performanceBonus.toLocaleString()}
                      </span>
                    </div>

                    {calculatedResult.performanceBonus !== calculatedResult.finalPerformanceBonus && (
                      <div className="flex justify-between text-red-500 text-xs pl-4">
                         <span>↳ 扣點懲罰 ({calculatedResult.penaltyStatus})</span>
                         <span>${calculatedResult.finalPerformanceBonus.toLocaleString()}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between">
                      <span>業務開發獎金</span>
                      <span>${calculatedResult.businessBonus.toLocaleString()}</span>
                    </div>

                    <div className="border-b-2 border-gray-200 my-3"></div>

                    <div className="flex justify-between text-lg font-bold text-gray-900">
                      <span>應發金額 (Gross)</span>
                      <span>${calculatedResult.grossSalary.toLocaleString()}</span>
                    </div>

                    <div className="bg-gray-50 p-3 rounded mt-3 space-y-1 text-xs text-gray-600">
                      <p className="font-bold mb-1">代扣項目 (勞工自負):</p>
                      <div className="flex justify-between">
                        <span>勞保費</span>
                        <span>-${calculatedResult.insurance.labor.emp}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>健保費</span>
                        <span>-${calculatedResult.insurance.health.emp}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-gray-200 font-bold text-gray-800">
                        <span>實領金額 (Net)</span>
                        <span>${calculatedResult.netSalary.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button 
                      onClick={handleSaveRecord}
                      className={`flex-1 text-white py-2 px-4 rounded-md flex items-center justify-center gap-2 ${calculatedResult.isPartTime ? 'bg-teal-600 hover:bg-teal-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      <Save className="w-4 h-4" /> 儲存資料
                    </button>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold text-gray-800 mb-2">考核結果預覽</h3>
                  <div className="flex items-center gap-4">
                    <div className={`text-4xl font-bold ${calculatedResult.kpiScore >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                      {calculatedResult.kpiScore}
                      <span className="text-sm text-gray-500 ml-1"> / {calculatedResult.maxPossibleScore} 分</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">狀態: {calculatedResult.kpiStatus}</p>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                        <div 
                          className={`h-2.5 rounded-full ${calculatedResult.kpiScore >= 70 ? 'bg-green-600' : 'bg-red-600'}`} 
                          style={{ width: `${(calculatedResult.kpiScore / calculatedResult.maxPossibleScore) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </Card>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg p-10">
                <AlertTriangle className="w-10 h-10 mb-2" />
                <p>請先選擇員工以開始試算</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'reports') {
      const employeeStats = employees.map(emp => {
        const empRecords = records.filter(r => r.empId === emp.id);
        const recordCount = empRecords.length;
        const totalIncome = empRecords.reduce((sum, r) => sum + r.result.grossSalary, 0);
        const totalCases = empRecords.reduce((sum, r) => sum + r.data.cases, 0);
        const avgKpi = recordCount ? (empRecords.reduce((sum, r) => sum + r.result.kpiScore, 0) / recordCount).toFixed(1) : 0;
        const avgCases = recordCount ? (totalCases / recordCount).toFixed(1) : 0;
        const avgIncome = recordCount ? Math.round(totalIncome / recordCount) : 0;
        const role = jobRoles.find(r => r.id === emp.roleId);
        
        return { ...emp, roleName: role?.name || '未知', roleType: role?.type, totalIncome, avgKpi, totalCases, avgCases, avgIncome, recordCount };
      });

      return (
        <div className="space-y-6">
          <h3 className="text-xl font-bold text-gray-800">年度人員總表</h3>
          <div className="grid grid-cols-1 gap-4">
            {employeeStats.map(stat => (
              <Card key={stat.id} className="p-4 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl ${stat.roleType === 'parttime' ? 'bg-teal-500' : (stat.level === 'A' ? 'bg-purple-600' : 'bg-blue-600')}`}>
                      {stat.roleType === 'parttime' ? 'PT' : stat.level}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">{stat.name} <span className="text-sm text-gray-500 font-normal">({stat.title})</span></h4>
                      <p className={`text-sm font-medium ${stat.roleType === 'parttime' ? 'text-teal-600' : 'text-blue-600'}`}>{stat.roleName}</p>
                    </div>
                  </div>
                  <div className="flex gap-8 text-center">
                    <div>
                      <p className="text-xs text-gray-500">平均 KPI</p>
                      <p className={`font-bold text-2xl ${parseFloat(stat.avgKpi) >= 70 ? 'text-green-600' : 'text-red-600'}`}>{stat.avgKpi}</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-xs text-gray-500 mb-1">年度總場次</p>
                    <p className="font-bold text-lg text-gray-800">{stat.totalCases} 場</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-xs text-gray-500 mb-1">每月平均場次</p>
                    <p className="font-bold text-lg text-blue-600">{stat.avgCases} 場</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-xs text-gray-500 mb-1">年度累積薪資</p>
                    <p className="font-bold text-lg text-gray-800">${stat.totalIncome.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-xs text-gray-500 mb-1">每月平均薪資</p>
                    <p className="font-bold text-lg text-blue-600">${stat.avgIncome.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    if (activeTab === 'settings') {
      return (
        <div className="space-y-8">
          {/* 職務類別管理 */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center">
              <Briefcase className="w-5 h-5 mr-2" /> 職務薪資結構設定
            </h3>
            <p className="text-sm text-gray-500">設定「正職 (月薪)」與「兼職 (時薪)」的計算參數。</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 表單 */}
              <Card className="p-6 md:col-span-1 h-fit bg-blue-50 border-blue-200">
                <h4 className="font-bold text-blue-800 mb-4 flex items-center">
                  {editingRole ? <Edit3 className="w-4 h-4 mr-2"/> : <Plus className="w-4 h-4 mr-2"/>}
                  {editingRole ? '編輯職務' : '新增職務'}
                </h4>
                <form onSubmit={handleSaveRole} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700">職務名稱</label>
                    <input name="name" defaultValue={editingRole?.name} required className="w-full border rounded p-2 text-sm" placeholder="例：特約護理師" />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-700">聘用類型</label>
                    <div className="flex gap-2 mt-1">
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name="type" value="fulltime" defaultChecked={!editingRole || editingRole.type === 'fulltime'} 
                            onChange={(e) => {
                                // 強制刷新表單顯示 (React key trick or simple state reload usually preferred, but this is simple HTML form)
                                // In this simple uncontrolled form, we use CSS/JS visibility logic visually or just let user ignore disabled fields
                            }}/>
                            <span className="text-sm">正職(月薪)</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name="type" value="parttime" defaultChecked={editingRole?.type === 'parttime'} />
                            <span className="text-sm">兼職(時薪)</span>
                        </label>
                    </div>
                  </div>

                  <div className="border-t border-blue-200 pt-2 my-2">
                    <p className="text-xs font-bold text-blue-800 mb-2">--- 正職專用參數 ---</p>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                        <label className="block text-xs text-gray-600">基本底薪</label>
                        <input name="baseSalary" type="number" defaultValue={editingRole?.baseSalary} className="w-full border rounded p-2 text-sm" />
                        </div>
                        <div>
                        <label className="block text-xs text-gray-600">責任額(場)</label>
                        <input name="baseQuota" type="number" defaultValue={editingRole?.baseQuota} className="w-full border rounded p-2 text-sm" />
                        </div>
                    </div>
                    <div className="mt-2">
                        <label className="block text-xs text-gray-600">超額單價(元/場)</label>
                        <input name="overQuotaRate" type="number" defaultValue={editingRole?.overQuotaRate} className="w-full border rounded p-2 text-sm" />
                    </div>
                     {/* 職等津貼 */}
                     <div className="bg-white p-2 rounded border border-blue-100 mt-2">
                        <label className="block text-xs font-bold text-gray-700 mb-2">職等津貼</label>
                        <div className="flex gap-2">
                           <input name="level_C" type="number" placeholder="C級" defaultValue={editingRole?.levelAllowances?.C} className="w-full border rounded p-1 text-xs" />
                           <input name="level_B" type="number" placeholder="B級" defaultValue={editingRole?.levelAllowances?.B} className="w-full border rounded p-1 text-xs" />
                           <input name="level_A" type="number" placeholder="A級" defaultValue={editingRole?.levelAllowances?.A} className="w-full border rounded p-1 text-xs" />
                        </div>
                     </div>
                  </div>

                  <div className="border-t border-blue-200 pt-2 my-2">
                    <p className="text-xs font-bold text-teal-800 mb-2">--- 兼職專用參數 ---</p>
                     <div className="grid grid-cols-2 gap-2">
                        <div>
                        <label className="block text-xs text-gray-600">約定時薪</label>
                        <input name="hourlyRate" type="number" defaultValue={editingRole?.hourlyRate} className="w-full border rounded p-2 text-sm" />
                        </div>
                        <div>
                        <label className="block text-xs text-gray-600">每場時數</label>
                        <input name="hoursPerCase" type="number" defaultValue={editingRole?.hoursPerCase || 2} className="w-full border rounded p-2 text-sm" />
                        </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700">新案獎金(元/案)</label>
                    <input name="newCaseBonus" type="number" defaultValue={editingRole?.newCaseBonus} required className="w-full border rounded p-2 text-sm" />
                  </div>

                  <div className="flex gap-2">
                    {editingRole && (
                      <button type="button" onClick={() => setEditingRole(null)} className="flex-1 bg-gray-400 text-white py-2 rounded text-sm">取消</button>
                    )}
                    <button className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm">
                      {editingRole ? '儲存變更' : '新增職務'}
                    </button>
                  </div>
                </form>
              </Card>

              {/* 職務列表 */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                {jobRoles.map(role => (
                  <Card key={role.id} className={`p-4 relative ${editingRole?.id === role.id ? 'ring-2 ring-blue-500' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                          <h4 className="font-bold text-lg text-gray-800">{role.name}</h4>
                          <span className={`text-xs px-2 py-0.5 rounded ${role.type === 'parttime' ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'}`}>
                              {role.type === 'parttime' ? '兼職' : '正職'}
                          </span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setEditingRole(role)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit3 className="w-4 h-4"/></button>
                        <button onClick={() => handleDeleteRole(role.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>
                    <div className="text-sm space-y-1 text-gray-600">
                      {role.type === 'fulltime' ? (
                          <>
                            <p>底薪: <span className="font-medium">${role.baseSalary.toLocaleString()}</span></p>
                            <p>責任額: <span className="font-medium">{role.baseQuota} 場</span></p>
                            <p>超額獎金: <span className="font-medium">${role.overQuotaRate}/場</span></p>
                            <div className="text-xs bg-gray-50 p-1 rounded mt-1">
                                津貼: C ${role.levelAllowances?.C} / B ${role.levelAllowances?.B} / A ${role.levelAllowances?.A}
                            </div>
                          </>
                      ) : (
                          <>
                            <p className="flex items-center gap-1"><Clock className="w-3 h-3"/> 每場: <span className="font-medium">{role.hoursPerCase} 小時</span></p>
                            <p className="flex items-center gap-1"><DollarSign className="w-3 h-3"/> 時薪: <span className="font-medium">${role.hourlyRate}</span></p>
                            <p className="text-teal-600 font-medium">= 單場費用: ${role.hourlyRate * role.hoursPerCase}</p>
                          </>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <hr className="border-gray-300"/>

          {/* KPI 管理 */}
          <div className="space-y-4">
             <h3 className="text-xl font-bold text-gray-800 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" /> KPI 考核項目設定
            </h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <Card className="p-6 md:col-span-1 h-fit">
                    <h4 className="font-bold text-gray-700 mb-4 flex items-center"><Plus className="w-4 h-4 mr-2"/> 新增考核指標</h4>
                    <form onSubmit={handleAddKpi} className="space-y-4">
                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">項目名稱</label>
                          <input name="label" required className="w-full border rounded p-2" placeholder="例如：團隊合作" />
                       </div>
                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">最高配分</label>
                          <input name="maxScore" type="number" required min="1" className="w-full border rounded p-2" placeholder="例如：10" />
                       </div>
                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">指標類別</label>
                          <select name="category" className="w-full border rounded p-2">
                             <option value="quantitative">定量 (Quantitative)</option>
                             <option value="qualitative">定性 (Qualitative)</option>
                          </select>
                       </div>
                       <button className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">新增項目</button>
                    </form>
                 </Card>

                 <div className="md:col-span-2 space-y-3">
                    {kpiDefinitions.map(kpi => (
                       <div key={kpi.id} className="bg-white border rounded-lg p-3 flex justify-between items-center">
                          <div>
                             <span className={`text-xs px-2 py-1 rounded mr-2 ${kpi.category === 'quantitative' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                               {kpi.category === 'quantitative' ? '定量' : '定性'}
                            </span>
                            <span className="font-bold text-gray-800">{kpi.label}</span>
                            <span className="text-sm text-gray-500 ml-2">(Max {kpi.maxScore}分)</span>
                          </div>
                          <button onClick={() => handleDeleteKpi(kpi.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                       </div>
                    ))}
                 </div>
             </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'employees') {
      return (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">新增員工</h3>
            <form onSubmit={handleAddEmployee} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                <input name="name" required className="w-full border rounded p-2" placeholder="王小美" />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">職務類別 (決定薪資結構)</label>
                <select name="roleId" className="w-full border rounded p-2 bg-blue-50">
                  {jobRoles.map(role => (
                    <option key={role.id} value={role.id}>{role.name} ({role.type === 'parttime' ? '兼職' : '正職'})</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">顯示職稱</label>
                <input name="title" required className="w-full border rounded p-2" placeholder="例: 資深顧問" />
              </div>
              <div className="w-full md:w-32">
                <label className="block text-sm font-medium text-gray-700 mb-1">職等 (正職用)</label>
                <select name="level" className="w-full border rounded p-2">
                  <option value="C">C級</option>
                  <option value="B">B級</option>
                  <option value="A">A級</option>
                </select>
              </div>
              <button className="w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">新增</button>
            </form>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {employees.map(e => {
              const role = jobRoles.find(r => r.id === e.roleId);
              const isPT = role?.type === 'parttime';
              return (
                <Card key={e.id} className="p-4 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                        <p className="font-bold text-lg">{e.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded ${isPT ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'}`}>
                            {isPT ? '兼職' : '正職'}
                        </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {role?.name || '未知職務'} <span className="text-gray-400">|</span> {e.title}
                    </p>
                    {!isPT && (
                        <p className="text-xs text-blue-600 mt-1 bg-blue-50 inline-block px-2 py-1 rounded">
                        Level {e.level} (津貼: ${role ? role.levelAllowances[e.level] : 0})
                        </p>
                    )}
                  </div>
                  <button 
                    onClick={() => handleDeleteEmployee(e.id)}
                    className="text-red-500 p-2 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Card>
              );
            })}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
      <div className="bg-slate-800 text-white p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <div className="bg-blue-500 p-2 rounded-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">安澤健康顧問</h1>
            <p className="text-xs text-slate-400">薪資與績效管理系統 v2.1 (正兼職版)</p>
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'dashboard', label: '總覽看板', icon: BarChart3 },
            { id: 'calculator', label: '薪資計算', icon: Calculator },
            { id: 'reports', label: '年度報表', icon: TrendingUp },
            { id: 'employees', label: '人員管理', icon: Users },
            { id: 'settings', label: '系統設定', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {renderContent()}
      </div>
    </div>
  );
}