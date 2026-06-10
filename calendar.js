/**
 * PROSERVICES — 달력 및 일정 관리 스크립트
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- 상태 관리 변수 ---
  let currentDate = new Date(); // 현재 화면에 보이는 년/월 기준 날짜
  let selectedDate = new Date(); // 사용자가 클릭해 선택한 날짜
  let schedules = JSON.parse(localStorage.getItem('ps_schedules')) || []; // 로컬스토리지 저장 데이터

  // --- DOM 요소 정의 ---
  const monthLabel = document.getElementById('cal-month-label');
  const calendarGrid = document.getElementById('calendar-grid');
  const prevBtn = document.getElementById('cal-prev');
  const nextBtn = document.getElementById('cal-next');
  const todayBtn = document.getElementById('cal-today');

  const selectedDateLabel = document.getElementById('selected-date-label');
  const scheduleList = document.getElementById('schedule-list');
  const addScheduleBtn = document.getElementById('add-schedule-btn');

  // 모달 관련 요소
  const scheduleModal = document.getElementById('schedule-modal');
  const scheduleForm = document.getElementById('schedule-form');
  const scheduleIdInput = document.getElementById('schedule-id');
  const scheduleTypeSelect = document.getElementById('schedule-type');
  const scheduleTitleInput = document.getElementById('schedule-title');
  const scheduleDateInput = document.getElementById('schedule-date');
  const scheduleStartTimeInput = document.getElementById('schedule-start');
  const scheduleEndTimeInput = document.getElementById('schedule-end');
  const scheduleWageInput = document.getElementById('schedule-wage');
  const scheduleMemoInput = document.getElementById('schedule-memo');
  const scheduleDeleteBtn = document.getElementById('schedule-delete-btn');
  const closeModalBtns = document.querySelectorAll('[data-close-schedule-modal]');

  const MIN_WAGE_2026 = 10320;
  const SCHEDULE_TYPE_LABELS = {
    work: '알바',
    personal: '개인',
    todo: '할 일',
  };
  const SCHEDULE_TYPE_CLASSES = {
    work: 'schedule-item-work',
    personal: 'schedule-item-personal',
    todo: 'schedule-item-todo',
  };

  // --- 날짜 포맷 헬퍼 함수 ---
  const formatDateString = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatMoney = (amount) =>
    `${Math.round(amount).toLocaleString('ko-KR')}원`;

  const parseHourlyWage = (value) => {
    const parsed = parseFloat(String(value || '').replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : MIN_WAGE_2026;
  };

  /** 시작·종료 시각으로 근무 시간(시간) 계산. 익일 퇴근 지원 */
  const workHoursFromTimes = (startTime, endTime) => {
    if (!startTime || !endTime) return null;

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if (!Number.isFinite(sh) || !Number.isFinite(eh)) return null;

    let startMinutes = sh * 60 + (sm || 0);
    let endMinutes = eh * 60 + (em || 0);
    if (endMinutes <= startMinutes) {
      endMinutes += 24 * 60;
    }

    return (endMinutes - startMinutes) / 60;
  };

  const isOvernightShift = (startTime, endTime) => {
    if (!startTime || !endTime) return false;

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if (!Number.isFinite(sh) || !Number.isFinite(eh)) return false;

    const startMinutes = sh * 60 + (sm || 0);
    const endMinutes = eh * 60 + (em || 0);
    return endMinutes <= startMinutes;
  };

  const formatTimeRange = (startTime, endTime) => {
    if (startTime && endTime) return `${startTime} ~ ${endTime}`;
    if (startTime) return `${startTime} ~`;
    if (endTime) return `~ ${endTime}`;
    return '시간 미입력';
  };

  const compareByStartTime = (a, b) => {
    if (a.startTime && b.startTime && a.startTime !== b.startTime) {
      return a.startTime.localeCompare(b.startTime);
    }
    return (a.title || '').localeCompare(b.title || '', 'ko');
  };

  const getTodaySchedules = () => {
    const todayStr = formatDateString(new Date());
    return schedules
      .filter((s) => s.date === todayStr)
      .slice()
      .sort(compareByStartTime);
  };

  const estimateWorkPay = (item) => {
    const hours = workHoursFromTimes(item.startTime, item.endTime);
    if (hours === null) return null;
    return hours * parseHourlyWage(item.hourlyWage);
  };

  const countByType = (items) => {
    const counts = { work: 0, personal: 0, todo: 0 };
    items.forEach((item) => {
      if (counts[item.type] !== undefined) counts[item.type] += 1;
    });
    return counts;
  };

  const buildTypeSummary = (counts) => {
    return Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([type, n]) => `${SCHEDULE_TYPE_LABELS[type]} ${n}건`)
      .join(' · ');
  };

  // --- 홈 화면: 오늘 급여 / 스케줄 요약 ---
  function refreshHomeSummaries() {
    const todayPayValue = document.getElementById('today-pay-value');
    const todayPayDesc = document.getElementById('today-pay-desc');
    const todayPayList = document.getElementById('home-today-pay-list');
    const todayScheduleValue = document.getElementById('today-schedule-value');
    const todayScheduleDesc = document.getElementById('today-schedule-desc');
    const todayScheduleList = document.getElementById('home-today-schedules');

    const todayAll = getTodaySchedules();
    const todayWork = todayAll.filter((s) => s.type === 'work');

    // 오늘의 급여
    if (todayPayValue && todayPayDesc) {
      if (todayWork.length === 0) {
        todayPayValue.textContent = '—';
        todayPayDesc.textContent = '오늘 알바 일정 없음';
      } else {
        let totalPay = 0;
        let hasMissingTime = false;

        todayWork.forEach((item) => {
          const pay = estimateWorkPay(item);
          if (pay === null) hasMissingTime = true;
          else totalPay += pay;
        });

        if (totalPay > 0) {
          todayPayValue.textContent = formatMoney(totalPay);
          todayPayDesc.textContent = `알바 ${todayWork.length}건 · 예상 급여(세전)`;
        } else if (hasMissingTime) {
          todayPayValue.textContent = '—';
          todayPayDesc.textContent = `알바 ${todayWork.length}건 · 시간 입력 시 예상 급여 표시`;
        } else {
          todayPayValue.textContent = formatMoney(0);
          todayPayDesc.textContent = `알바 ${todayWork.length}건`;
        }
      }
    }

    if (todayPayList) {
      todayPayList.replaceChildren();

      if (todayWork.length === 0) {
        todayPayList.hidden = true;
      } else {
        todayPayList.hidden = false;

        todayWork.forEach((item) => {
          const hours = workHoursFromTimes(item.startTime, item.endTime);
          const pay = estimateWorkPay(item);
          const wage = parseHourlyWage(item.hourlyWage);

          const li = document.createElement('li');
          li.className = 'home-pay-item';

          const main = document.createElement('div');
          main.className = 'home-pay-item-main';

          const title = document.createElement('p');
          title.className = 'home-pay-item-title';
          title.textContent = item.title || '알바';

          const meta = document.createElement('p');
          meta.className = 'home-pay-item-meta';
          if (hours !== null) {
            meta.textContent = `${formatTimeRange(item.startTime, item.endTime)} · ${formatMoney(wage)}/시`;
          } else {
            meta.textContent = formatTimeRange(item.startTime, item.endTime);
          }

          main.appendChild(title);
          main.appendChild(meta);

          const amount = document.createElement('span');
          amount.className = 'home-pay-item-amount';
          amount.textContent = pay !== null ? formatMoney(pay) : '—';

          li.appendChild(main);
          li.appendChild(amount);
          todayPayList.appendChild(li);
        });
      }
    }

    // 오늘의 스케줄
    if (todayScheduleValue && todayScheduleDesc) {
      const count = todayAll.length;

      todayScheduleValue.textContent = `${count}건`;

      if (count === 0) {
        todayScheduleDesc.textContent = '등록된 일정이 없습니다';
      } else if (count === 1) {
        const only = todayAll[0];
        const typeLabel = SCHEDULE_TYPE_LABELS[only.type] || '일정';
        todayScheduleDesc.textContent = `${typeLabel} · ${only.title}`;
      } else {
        todayScheduleDesc.textContent = buildTypeSummary(countByType(todayAll));
      }
    }

    if (todayScheduleList) {
      todayScheduleList.replaceChildren();

      if (todayAll.length === 0) {
        todayScheduleList.hidden = true;
      } else {
        todayScheduleList.hidden = false;

        todayAll.forEach((item) => {
          const li = document.createElement('li');
          const typeClass =
            SCHEDULE_TYPE_CLASSES[item.type] || 'schedule-item-work';
          li.className = `home-schedule-card ${typeClass}`;

          if (isOvernightShift(item.startTime, item.endTime)) {
            li.classList.add('is-overnight');
          }

          const accent = document.createElement('div');
          accent.className = 'home-schedule-card-accent';
          accent.setAttribute('aria-hidden', 'true');

          const body = document.createElement('div');
          body.className = 'home-schedule-card-body';

          const top = document.createElement('div');
          top.className = 'home-schedule-card-top';

          const badge = document.createElement('span');
          badge.className = 'home-schedule-card-badge';
          badge.textContent = SCHEDULE_TYPE_LABELS[item.type] || '일정';

          const time = document.createElement('span');
          time.className = 'home-schedule-card-time';
          time.textContent = formatTimeRange(item.startTime, item.endTime);

          top.appendChild(badge);
          top.appendChild(time);

          const title = document.createElement('p');
          title.className = 'home-schedule-card-title';
          title.textContent = item.title || '(제목 없음)';

          body.appendChild(top);
          body.appendChild(title);

          if (item.memo) {
            const memo = document.createElement('p');
            memo.className = 'home-schedule-card-memo';
            memo.textContent = item.memo;
            body.appendChild(memo);
          }

          li.appendChild(accent);
          li.appendChild(body);

          if (item.type === 'work') {
            const pay = estimateWorkPay(item);
            if (pay !== null) {
              const payEl = document.createElement('span');
              payEl.className = 'home-schedule-card-pay';
              payEl.textContent = formatMoney(pay);
              li.appendChild(payEl);
            }
          }

          todayScheduleList.appendChild(li);
        });
      }
    }
  }

  function persistSchedulesAndRefresh() {
    localStorage.setItem('ps_schedules', JSON.stringify(schedules));
    renderCalendar();
    renderScheduleList();
    refreshHomeSummaries();
  }

  // --- 1. 달력 렌더링 함수 ---
  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // 상단 툴바 레이블 변경 (예: 2026년 5월)
    if (monthLabel) {
      monthLabel.textContent = `${year}년 ${month + 1}월`;
    }

    if (!calendarGrid) return;
    calendarGrid.innerHTML = ''; // 기존 달력 그리드 초기화

    // 이번 달의 첫날과 마지막 날 구하기
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // 지난 달의 마지막 날 구하기 (이전 달 빈칸 채우기용)
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    // 첫날의 요일 (0: 일요일 ~ 6: 토요일)
    const startDayOfWeek = firstDayOfMonth.getDay();
    // 이번 달 총 일수
    const totalDays = lastDayOfMonth.getDate();

    // 1-1. 지난 달 날짜 채우기 (비활성화 스타일)
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevCell = document.createElement('div');
      prevCell.className = 'p-2 text-gray-300';
      prevCell.textContent = dayNum;
      calendarGrid.appendChild(prevCell);
    }

    // 1-2. 이번 달 날짜 채우기
    for (let day = 1; day <= totalDays; day++) {
      const thisDate = new Date(year, month, day);
      const dateStr = formatDateString(thisDate);

      const dayBtn = document.createElement('button');
      dayBtn.type = 'button';
      dayBtn.dataset.date = dateStr;

      // 기본 요일별 색상 및 Tailwind 스타일링
      const dayOfWeek = thisDate.getDay();
      let textColorClass = 'text-gray-800';
      if (dayOfWeek === 0) textColorClass = 'text-red-500'; // 일요일
      if (dayOfWeek === 6) textColorClass = 'text-blue-500'; // 토요일

      dayBtn.className = `p-2 hover:bg-indigo-50 rounded-lg relative flex flex-col items-center justify-center font-medium ${textColorClass}`;
      
      // 날짜 텍스트 노드 추가
      const spanText = document.createElement('span');
      spanText.textContent = day;
      dayBtn.appendChild(spanText);

      // 오늘 날짜 하이라이트
      const todayStr = formatDateString(new Date());
      if (dateStr === todayStr) {
        dayBtn.classList.remove('hover:bg-indigo-50');
        dayBtn.classList.add('bg-indigo-600', 'text-white', 'font-semibold', 'shadow-sm');
        // 오늘이 토/일인 경우 글자색 겹침 방지
        dayBtn.classList.remove('text-red-500', 'text-blue-500', 'text-gray-800');
      }

      // 선택된 날짜 테두리 표시
      if (dateStr === formatDateString(selectedDate)) {
        dayBtn.classList.add('ring-2', 'ring-indigo-400');
      }

      // 해당 날짜에 일정이 존재하는지 체크하여 점(Dot) 표시
      const hasSchedule = schedules.some(s => s.date === dateStr);
      if (hasSchedule && dateStr !== todayStr) {
        const dot = document.createElement('span');
        dot.className = 'w-1 h-1 bg-emerald-500 rounded-full absolute bottom-1';
        dayBtn.appendChild(dot);
      }

      // 날짜 클릭 이벤트
      dayBtn.addEventListener('click', () => {
        selectedDate = new Date(thisDate);
        renderCalendar();
        renderScheduleList();
      });

      calendarGrid.appendChild(dayBtn);
    }

    // 1-3. 다음 달 날짜 채우기 (마지막 주 빈칸 7칸 맞추기)
    const totalRenderedDays = startDayOfWeek + totalDays;
    const remainingSlots = (7 - (totalRenderedDays % 7)) % 7;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextCell = document.createElement('div');
      nextCell.className = 'p-2 text-gray-300';
      nextCell.textContent = i;
      calendarGrid.appendChild(nextCell);
    }
  }

  // --- 2. 선택된 날짜의 일정 목록 렌더링 함수 ---
  function renderScheduleList() {
    const dateStr = formatDateString(selectedDate);
    
    // 일정 패널 타이틀 날짜 업데이트 (예: 5월 25일 일정)
    if (selectedDateLabel) {
      selectedDateLabel.textContent = `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 일정`;
    }

    if (!scheduleList) return;
    scheduleList.innerHTML = '';

    // 해당 날짜 필터링
    const daySchedules = schedules.filter(s => s.date === dateStr);

    if (daySchedules.length === 0) {
      scheduleList.innerHTML = `<li class="p-4 text-center text-gray-400 text-sm">등록된 일정이 없습니다.</li>`;
      return;
    }

    daySchedules.forEach(item => {
      const li = document.createElement('li');
      li.className = 'p-3 bg-gray-50 rounded-xl flex justify-between items-center border border-gray-100 hover:border-indigo-100 transition-all cursor-pointer';
      
      // 유형별 배지 스타일 지정
      let typeBadge = '';
      if (item.type === 'work') typeBadge = '<span class="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-xs rounded font-medium mr-2">알바</span>';
      else if (item.type === 'personal') typeBadge = '<span class="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded font-medium mr-2">개인</span>';
      else typeBadge = '<span class="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded font-medium mr-2">할일</span>';

      // 시간 정보 포맷팅
      const timeInfo = item.startTime && item.endTime ? `<span class="text-xs text-gray-400 block mt-0.5">${item.startTime} ~ ${item.endTime}</span>` : '';
      const memoInfo = item.memo ? `<p class="text-xs text-gray-500 mt-1 italic">${item.memo}</p>` : '';

      li.innerHTML = `
        <div>
          <div class="flex items-center">
            ${typeBadge}
            <strong class="text-sm text-gray-700 font-semibold">${item.title}</strong>
          </div>
          ${timeInfo}
          ${memoInfo}
        </div>
        <div class="text-right">
          ${item.type === 'work' && item.hourlyWage ? `<span class="text-xs font-bold text-indigo-600 block">${Number(item.hourlyWage).toLocaleString()}원/시</span>` : ''}
          <span class="text-xs text-gray-400 hover:text-indigo-600 font-medium">수정</span>
        </div>
      `;

      // 리스트 아이템 클릭 시 수정 모달 팝업
      li.addEventListener('click', () => openScheduleModal(item));
      scheduleList.appendChild(li);
    });
  }

  // --- 3. 모달 제어 함수 ---
  function openScheduleModal(scheduleToEdit = null) {
    if (!scheduleModal) return;

    if (scheduleToEdit) {
      // 수정 모드
      scheduleIdInput.value = scheduleToEdit.id;
      scheduleTypeSelect.value = scheduleToEdit.type;
      scheduleTitleInput.value = scheduleToEdit.title;
      scheduleDateInput.value = scheduleToEdit.date;
      scheduleStartTimeInput.value = scheduleToEdit.startTime || '';
      scheduleEndTimeInput.value = scheduleToEdit.endTime || '';
      scheduleWageInput.value = scheduleToEdit.hourlyWage || '';
      scheduleMemoInput.value = scheduleToEdit.memo || '';
      
      if (scheduleDeleteBtn) scheduleDeleteBtn.hidden = false;
      document.getElementById('schedule-modal-title').textContent = '일정 수정';
    } else {
      // 새 일정 추가 모드
      scheduleForm.reset();
      scheduleIdInput.value = '';
      scheduleDateInput.value = formatDateString(selectedDate); // 현재 선택된 날짜 기본 주입
      
      if (scheduleDeleteBtn) scheduleDeleteBtn.hidden = true;
      document.getElementById('schedule-modal-title').textContent = '일정 추가';
    }

    scheduleModal.removeAttribute('hidden');
    scheduleModal.setAttribute('aria-hidden', 'false');
  }

  function closeScheduleModal() {
    if (!scheduleModal) return;
    scheduleModal.setAttribute('hidden', '');
    scheduleModal.setAttribute('aria-hidden', 'true');
  }

  // --- 4. 이벤트 리스너 연동 ---

  // 툴바 버튼 이벤트
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      currentDate = new Date();
      selectedDate = new Date();
      renderCalendar();
      renderScheduleList();
    });
  }

  // 일정 추가 버튼 클릭
  if (addScheduleBtn) {
    addScheduleBtn.addEventListener('click', () => openScheduleModal());
  }

  // 모달 닫기 버튼 연동
  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', closeScheduleModal);
  });

  // 일정 폼 등록 및 수정 완료 (Submit)
  if (scheduleForm) {
    scheduleForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const id = scheduleIdInput.value;
      const newSchedule = {
        id: id || String(Date.now()), // 수정이면 기존 ID 유지, 신규면 타임스탬프 생성
        type: scheduleTypeSelect.value,
        title: scheduleTitleInput.value.trim(),
        date: scheduleDateInput.value,
        startTime: scheduleStartTimeInput.value,
        endTime: scheduleEndTimeInput.value,
        hourlyWage: scheduleWageInput.value.replace(/,/g, ''), // 쉼표 제거 후 저장
        memo: scheduleMemoInput.value.trim()
      };

      if (!newSchedule.title) return alert('제목을 입력해 주세요.');

      if (id) {
        // 기존 데이터 수정 업데이트
        const index = schedules.findIndex(s => s.id === id);
        if (index !== -1) schedules[index] = newSchedule;
      } else {
        // 새 데이터 추가
        schedules.push(newSchedule);
      }

      closeScheduleModal();
      persistSchedulesAndRefresh();
    });
  }

  // 일정 삭제 기능
  if (scheduleDeleteBtn) {
    scheduleDeleteBtn.addEventListener('click', () => {
      const id = scheduleIdInput.value;
      if (!id) return;

      if (confirm('이 일정을 삭제하시겠습니까?')) {
        schedules = schedules.filter(s => s.id !== id);
        closeScheduleModal();
        persistSchedulesAndRefresh();
      }
    });
  }

  // 알바 유형일 때만 시급 입력란 활성화하는 팁 처리
  if (scheduleTypeSelect) {
    scheduleTypeSelect.addEventListener('change', (e) => {
      const wageField = document.getElementById('schedule-wage-field');
      if (wageField) {
        wageField.hidden = (e.target.value !== 'work');
      }
    });
  }

  window.HowMoney = window.HowMoney || {};
  window.HowMoney.refreshHomeSummaries = refreshHomeSummaries;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    try {
      schedules = JSON.parse(localStorage.getItem('ps_schedules') || '[]');
    } catch {
      schedules = [];
    }
    refreshHomeSummaries();
    renderCalendar();
    renderScheduleList();
  });

  // --- 최초 실행 초기화 ---
  renderCalendar();
  renderScheduleList();
  refreshHomeSummaries();
});