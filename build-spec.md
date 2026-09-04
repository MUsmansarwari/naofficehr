# NA Office HR — Build Spec

Internal tool. Single admin user (manager). Multiple companies. No tax. No user roles.

---

## 1. Core rules (yeh sab kuch drive karte hain)

### Salary basis
- **Fixed 30-day divisor**, chahe month mein 28 din hon ya 31.
- `per_day_rate = monthly_salary ÷ 30`
- Example: 150,000 ÷ 30 = 5,000 per day. Ek din ki deduction = 5,000.
- Divisor company setting hai (default 30) — kisi company ke liye 26 chahiye to change ho jaye.
- **Cap rule:** pro-rated base kabhi `monthly_salary` se zyada nahi ho sakta. 31-din wale month mein 1 tareekh ka joiner `per_day × 31` = 103% banta hai — `min(per_day × days, monthly_salary)` lagao. Yahi cap exit settlement pe bhi.

### Salary history (`salary_structures`)
- Salary `employees` pe nahi, `salary_structures` table mein rehti hai: `effective_from` date ke saath. Employee ki current salary = latest row jiska `effective_from <= today`.
- Salary change = nayi row. Purani row kabhi edit/delete nahi hoti.
- **Mid-month change:** per-day loop mein har din ki salary us din ki effective row se aati hai. Payslip pe `monthly_salary` = month ki last date wali salary (display), lekin `base_amount` per-day sum se banta hai.

### Day types
Har calendar date in 6 mein se ek hoti hai:

| Type | Paid? |
|---|---|
| `present` | Paid |
| `weekly_off` | Paid |
| `public_holiday` | Paid (probation mein configurable) |
| `leave_paid` | Paid — annual quota se katti hai |
| `leave_unpaid` | **Deduct** |
| `absent` | **Deduct** |

### Probation rule
- Probation ke dauran **koi bhi leave paid nahi** — har leave `leave_unpaid` ban jaati hai, chahe quota bacha ho.
- Weekly offs probation mein bhi paid rehte hain (warna 150k wala banda 8 din ka nuqsan uthayega har month).
- Public holidays probation mein paid rahenge ya nahi — **company setting** (`deduct_public_holidays_in_probation`, default `false`).
- Probation khatam hone ki date auto-calculate hoti hai (`join_date + probation_months`, default 3) lekin manually override ho sakti hai.
- Confirmation ke baad se paid leave quota chalna shuru.

### Paid leave quota
- Default **8 per year** (sick), per employee override kar sakte ho — kam ya zyada.
- Calendar year ke hisab se track hoti hai.
- Quota khatam hone ke baad har leave automatically `leave_unpaid`.
- Manager kisi bhi din ko manually `leave_paid` ya `leave_unpaid` force kar sakta hai — override hamesha jeeta hai.
- **Koi `leave_balances` table nahi.** Balance = quota − (is saal ke `leave_paid` attendance rows jo probation ke baad hain). Derived, stored nahi.
- **Consumption order = chronological by shift date.** Saal ki pehli 8 confirmed-stage leaves paid, baaki unpaid. Probation ki leaves count mein aati hi nahi.
- **Locked month freeze:** quota resolve karte waqt locked payroll months ke `leave_paid` rows fixed hain — wo dobara classify nahi hote. Sirf unlocked months ki leaves recompute hoti hain. Agar manager locked month mein back-dated leave daale, wo `leave_unpaid` jaati hai aur warning dikhti hai: "Month locked — is din ka paisa is payslip mein nahi katega, next payroll mein manual adjustment karo."

### Payroll formula — **per-day loop, month-level flag nahi**

Probation mid-month khatam ho sakti hai, salary mid-month badal sakti hai — is liye har din alag resolve hota hai.

```
for each calendar date in month:
  if date < join_date or (exit_date and date > exit_date):  skip

  salary_today  = salary_structures row effective on date
  per_day       = salary_today ÷ divisor
  on_probation  = date < probation_end_date
  day_type      = resolve per section 5

  payable_days  += 1
  if day_type in (absent, leave_unpaid):                   unpaid_days += 1
  if day_type == public_holiday and on_probation
     and company.deduct_public_holidays_in_probation:      unpaid_days += 1
  if day_type == leave_paid and not on_probation
     and quota_remaining > 0:                              quota_remaining -= 1
  elif day_type == leave_paid:                             day_type = leave_unpaid; unpaid_days += 1

  base       += per_day        (worked ya paid off — har payable din)
  deduction  += per_day        (sirf unpaid din)

base        = min(base, monthly_salary_of_month_end)      ← cap
advance_due = min(installment_amount, remaining_amount)   ← last installment partial
advance_due = min(advance_due, base − deduction)          ← salary kabhi negative nahi

net_payable = base − deduction − advance_due
            + other_additions   (bonus, arrears — manual, note zaroori)
            − other_deductions  (manual, note zaroori)
```

- Rounding sirf ek jagah: `per_day` integer paisa mein floor. Baaki sab integer add/subtract.
- `was_on_probation` payslip pe tab true jab month ka **koi bhi** din probation mein tha.

---

## 2. Data model (SQLite / Drizzle)

Sab paisa **integers mein** store karo (paisa/cents). Float kabhi nahi.
Sab dates **`YYYY-MM-DD` strings** — Date objects timezone bugs deti hain.

```
settings                              -- single row, app-wide
  id (=1), schema_version, last_backup_at, updated_at

companies
  id, name, slug UNIQUE, timezone (default 'Asia/Karachi'), currency (default 'PKR'),
  salary_divisor (default 30),
  shift_start, shift_end,            -- '20:00', '05:00' — end < start matlab agle din khatam
  weekly_offs           -- JSON array, e.g. [0,6] = Sunday+Saturday
  default_probation_months (default 3),
  default_leave_quota   (default 8),
  deduct_public_holidays_in_probation (bool, default false),
  checkin_enabled (bool), created_at

employees
  id, company_id, code, name, phone, email, cnic, designation,
  join_date, exit_date,
  exit_type,                         -- resigned | terminated | contract_ended | probation_failed
  probation_months, probation_end_date,
  employment_stage,                  -- probation | confirmed
  status,                            -- active | exited | archived
  leave_quota_annual,                -- per-employee override
  checkin_pin,                       -- 4 digits, nullable
  bank_name, account_number, notes
  UNIQUE(company_id, code)
  UNIQUE(company_id, checkin_pin)    -- NULL allowed, duplicate nahi

salary_structures
  id, employee_id, monthly_salary,   -- integer paisa
  effective_from,                    -- 'YYYY-MM-DD'
  note, created_at
  UNIQUE(employee_id, effective_from)
  -- employee create pe pehli row automatically banti hai (effective_from = join_date)

holidays
  id, company_id, date, name,
  source,                            -- 'us_federal' | 'pakistan' | 'custom'
  is_active                          -- delete ki jagah deactivate karo
  UNIQUE(company_id, date)           -- preset import dobara chalao to upsert, duplicate nahi

attendance
  id, employee_id, date,
  status,                            -- present|absent|leave_paid|leave_unpaid|weekly_off|public_holiday
  check_in_at, check_out_at,         -- UTC timestamps, nullable
  source,                            -- 'checkin' | 'manual'
  is_override (bool),
  time_entered_by_hand (bool),       -- employee ne khud time type kiya
  note, updated_at
  UNIQUE(employee_id, date)          -- date = SHIFT date, calendar date nahi

advances
  id, employee_id, amount, reason, given_on,
  installment_amount, remaining_amount,
  start_month,                       -- 'YYYY-MM'
  status,                            -- active | paused | closed
  note, created_at

advance_installments
  id, advance_id, payroll_run_id, month, amount, created_at

payroll_runs
  id, company_id, month, year, status,   -- draft | locked
  divisor_used, generated_at, locked_at, unlocked_at, unlock_reason
  UNIQUE(company_id, year, month)        -- ek month, ek run

payslips
  id, payroll_run_id, employee_id,
  monthly_salary, per_day_rate, divisor,
  UNIQUE(payroll_run_id, employee_id)
  present_days, weekly_off_days, public_holiday_days,
  leave_paid_days, leave_unpaid_days, absent_days,
  payable_days, unpaid_days,
  base_amount, deduction_amount, advance_deduction,
  other_additions, other_additions_note,
  other_deductions, other_deductions_note,
  net_payable, was_on_probation (bool)

checkin_attempts                     -- public page ki har koshish
  id, company_id, ip, pin_hash, success (bool), employee_id (nullable), at

audit_log
  id, entity_type, entity_id,        -- 'attendance' | 'employee' | 'salary_structure' | 'advance' | 'payroll_run' | 'holiday'
  action,                            -- create | update | delete | lock | unlock | override
  before_json, after_json,           -- poora row snapshot, diff nahi
  note, at
```

**Sabse zaroori rule:** payslip pe har calculated number **snapshot** hota hai. Payroll lock hone ke baad wo kabhi recompute nahi hota. Agar 6 mahine baad salary badli, purana payslip wahi purana number dikhayega.

**Audit log kyun:** section 9 ka poora justification "dispute mein proof" hai. Record bachana kaafi nahi — *kab kisne kya badla* bhi chahiye. Single admin hai, phir bhi: manager khud bhool jaata hai 3 mahine baad ke usne March 14 ko absent se present kyun kiya. Har attendance override, salary change, advance edit, payroll lock/unlock ki entry jaati hai. Employee detail pe "History" tab.

---

## 3. Screens

| # | Screen | Kya karta hai |
|---|---|---|
| 1 | Login | Ek password. Env variable se. Signed cookie session — **7 din expiry**, logout button, har mutation pe origin check (CSRF) |
| 2 | Dashboard | Company switcher (top bar). Aaj kitne present/absent. Probation ending soon alerts. Outstanding advances |
| 3 | Employees | List with filters. Probation badge. Add / edit / deactivate |
| 4 | Employee detail | View mode: sab details, is saal ka paid leave / unpaid / advance, payslip history. **Edit details** button → inline form (name, phone, email, designation, salary, leave quota, joined, probation months, PIN) → Save / Cancel. Salary change se nayi `salary_structures` row bane, purani lock rahe |
| 5 | Attendance grid | **Sabse important screen.** Rows = employees, columns = month ke din. Cell click karke status change. Bulk mark (poori row / poora column). Colour coded |
| 6 | Holidays | Company + year select. USA federal aur Pakistan preset import buttons. Manually add/edit/remove |
| 7 | Advances | New advance form (amount, installment, start month). Schedule preview. Pause / close early / adjust |
| 8 | Payroll | Company + month → Generate Draft → editable review table → Lock. Locked ke baad read-only. **Regenerate** draft pe purane payslips + us run ki `advance_installments` delete ho ke dobara bante hain (idempotent). **Unlock** = reason zaroori, audit entry, advance `remaining_amount` restore, status wapis draft |
| 9 | Payslip | Ek employee ka printable page. Full breakdown. Browser print → PDF |
| 10 | Reports | Monthly salary register (sab employees, exportable CSV), attendance summary, advance outstanding. **CSV columns:** code, name, designation, monthly_salary, payable_days, unpaid_days, base, deduction, advance, additions, deductions, net_payable, bank_name, account_number |
| 11 | Settings | Company CRUD, **office hours (start/end, 12-hour)**, divisor, weekly offs, probation defaults, leave quota default, probation-holiday toggle, backup |
| 12 | `/checkin/[slug]` | **Public.** Login nahi, naam list nahi. PIN keypad → apna naam → Check in / Check out → optional manual time (12-hour) |

---

## 4. Check-in / check-out flow (PIN based)

Public page: `/checkin/[company-slug]`. Login nahi. Naamon ki list bhi nahi dikhti.

```
1. Keypad → employee 4-digit PIN dale
2. PIN unique hai company ke andar → seedha uska naam + aaj ka status
3. Ek bada button:
     abhi tak check-in nahi     → "Check in now"
     check-in ho chuka          → "Check out now"
     dono ho chuke              → "Done for today" (dikhaye, edit link ke saath)
4. Neeche: "Forgot earlier? Enter the time yourself"
     → 12-hour time picker (hh:mm + AM/PM)
     → sirf current shift-date ke liye
     → record pe time_entered_by_hand = true
     → manager ko attendance grid mein amber dot dikhta hai
5. "Start over" link → keypad wapis
```

- PIN manager assign karta hai employee profile se. Same company mein do employees ka same PIN nahi ho sakta (DB constraint).
- Sab times **12-hour format** mein dikhte hain (8:04 PM), DB mein UTC.

### Brute-force protection — per-IP, per-PIN nahi
4-digit PIN aur 50 employees = har random guess pe 0.5% hit. Per-PIN lockout bekaar hai kyunki attacker PIN badalta rehta hai.
- Har attempt `checkin_attempts` mein log (IP, success, time).
- **Per-IP:** 10 fail in 10 min → 15 min block. Page pe "Too many attempts, try later".
- **Per-company:** 100 fail in 1 hour → poora check-in page 1 hour ke liye off, manager ko dashboard pe red banner.
- Dashboard pe "failed check-in attempts (24h)" counter — 0 hona chahiye normally.

### Manual time validation
- Entered time current shift window ke andar hona chahiye (`shift_start − 2h` se `shift_end + 3h` tak, shift-date ke hisab se).
- Check-out check-in ke baad hona chahiye — midnight cross ko UTC mein compare karo, local time strings mein nahi.
- Future time reject.
- Koi bhi fail ho to inline error, record save nahi.

### Shift date — yeh sabse zaroori logic hai

Office hours 8:00 PM – 5:00 AM hain, shift midnight cross karta hai. Har attendance record ka `date` **shift date** hai — jis din shift shuru hui:

```
function shiftDate(now, company):
  local = now in company.timezone
  if company.shift_end < company.shift_start:          # crosses midnight
     if local.time < company.shift_end + buffer(3h):    # 5 AM + 3h = 8 AM tak
        return local.date − 1 day                       # abhi bhi pichli raat ka shift hai
  return local.date
```

- Friday 8:04 PM check-in → Friday
- Saturday 5:12 AM check-out → **Friday** (same record mein jaata hai)
- Saturday 4:55 AM manual entry → Friday
- Manager ka attendance grid bhi shift-date pe chalta hai: "Friday" column mein Friday raat ka shift

Agar yeh galat kiya to har check-out agle din ka alag record ban jayega aur poora month double dikhega.

## 5. Absent kaise decide hota hai

Koi background cron nahi chahiye. **Payroll generate karte waqt** compute karo:

```
har calendar date for the month:
  if date < join_date or (exit_date and date > exit_date)  → skip (pro-rate)
  else if attendance.is_override                            → uska status (manager ka faisla hamesha jeetta hai)
  else if weekday in company.weekly_offs                    → weekly_off
  else if date is public_holiday                            → public_holiday
  else if attendance record exists                          → uska status
  else                                                       → absent
```

**Order kyun aisa:**
- `weekly_off` **pehle**, `public_holiday` baad mein. Warna Sunday wala holiday `public_holiday` ban jaata hai aur probation toggle on ho to us din ka paisa katta hai jo waise bhi off tha.
- Off-day (weekly off / holiday) pe check-in ho to bhi din `weekly_off`/`public_holiday` hi rehta hai — check-in time record hota hai, grid mein chhota dot dikhta hai, lekin koi overtime/extra pay nahi. Overtime scope mein nahi.
- Manager override sab se upar — override karke off-day ko `present` ya `absent` banaya ja sakta hai.

Iska matlab past ka data jab chaho recompute kar sakte ho — jab tak payroll lock na ho.

---

## 6. Stack — poora free, koi hosting bill nahi

| Layer | Choice | Free tier (Sept 2026) | Kyun |
|---|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | — | Frontend + API ek jagah. Claude Code isko sabse acha handle karta hai |
| Database | **Turso** (libSQL = SQLite cloud) | 9 GB storage, 500 databases, 500M row reads/month, **commercial use allowed**, kabhi expire nahi hota, koi inactivity pause nahi | Wahi SQLite schema, bas cloud pe. Drizzle directly support karta hai |
| ORM | **Drizzle** with `@libsql/client` | — | TypeScript-native, migrations simple |
| Hosting | **Netlify** | 100 GB bandwidth, 300 build minutes, 125K function calls/month, **commercial use allowed** | Next.js natively supported. Is app ke liye limits kaafi se zyada |
| UI | **Tailwind + shadcn/ui** | — | Tables, dialogs, date pickers ready |
| Dates | `date-fns` + `date-fns-tz` | — | Timezone khud mat handle karna |
| Auth | Password env var mein + signed cookie | — | Ek user hai |
| PDF | Print CSS + browser print | — | Zero dependency |

**Vercel kyun nahi:** Hobby plan personal/non-commercial only hai. Business use ToS violation.
**Supabase kyun nahi:** 7 din inactivity pe project pause. Eid ki chhuttiyon ke baad app band mile — nahi chahiye.
**Cloudflare D1 kyun nahi:** kaam karta hai, lekin Next.js ko OpenNext adapter chahiye — Claude Code ke liye extra friction. Turso + Netlify seedha chalta hai.

**Total monthly cost: Rs 0.** Domain optional (~Rs 3,500/saal), warna Netlify ka `*.netlify.app` free subdomain.

### Backup — one-click download

Settings page pe **"Download backup"** button:
1. Sab tables (settings, companies, employees, salary_structures, holidays, attendance, advances, installments, payroll_runs, payslips, audit_log) ko ek JSON file mein export karo: `na-office-hr-YYYY-MM-DD.json`. File ke top pe `{ "schema_version": N, "exported_at": ..., "tables": {...} }` — `schema_version` ke bina restore refuse karo. Purana version ho to migrate-on-restore, ya saaf error: "Backup v2 hai, app v4 chahta hai."
2. Browser download trigger ho — file manager ke computer pe aa jaaye
3. `settings` table mein `last_backup_at` store karo
4. Dashboard aur sidebar pe **"Last backup X days ago"** dikhao. 30 din se zyada ho to amber banner: "Backup is a month old — download now"
5. **"Restore from backup"** — JSON upload karo, preview dikhao (kitne employees, kitne payslips), confirm pe poora data replace. Restore se pehle current state ka auto-backup

JSON is liye ke wo platform-independent hai — Turso chhorna pade to bhi data tumhare paas readable format mein hai. SQLite `.db` file bhi de sakte ho as second option, lekin JSON primary.

## 7. Claude Code ke liye build order

Har phase alag session mein karo, ek hi prompt mein sab mat maango.

**Phase 0 — UI reference (LOCKED)**
> ✅ `design/ui-mockup.html` bana hua hai (5 Sept 2026). 6 screens ek file mein — bottom-right switcher se: Dashboard, Attendance grid (cell popover ke saath), Payroll review, Payslip (print-ready), Employee detail (audit History), public Check-in (3 states). Sab palette tokens `:root` mein CSS variables hain — code mein wahi naam use karo.
>
> `ui-mockup.html` ko repo mein `/design/` folder mein rakho aur har phase ke prompt mein likho: "Match design/ui-mockup.html exactly — same palette, IBM Plex Sans, same sidebar layout."
>
> Palette (change mat karna):
> - `#EAECEB` chalk — page background
> - `#FFFFFF` — tables, forms, cards
> - `#1E2229` deep navy — text, sidebar background, secondary buttons
> - `#D0C3B1` sand — dividers, holiday cells; `#E4DDD1` for soft lines
> - `#D97706` amber — primary buttons, active nav mark, "typed by hand" dot. **Sirf actions pe**, decoration pe nahi
> - `#B4432B` red — sirf absent/unpaid. Palette se bahar hai lekin zaroori hai, kyunki absent alarming dikhna chahiye

**Phase 1 — Foundation**
> Next.js 15 + TypeScript + Tailwind + shadcn/ui + Drizzle + `@libsql/client` (Turso) setup. Upar wala schema banao migrations ke saath. Single-password auth with signed cookie. Company switcher wala layout shell.

**Phase 2 — Masters**
> Companies CRUD + settings page (office hours, weekly offs, defaults). Employees CRUD with probation auto-calculation. Holidays page with USA federal + Pakistan preset seed data aur manual add/edit/remove.

**Phase 3 — Attendance**
> Public check-in page: PIN keypad, check in / check out, manual 12-hour time entry with flag. `shiftDate()` function pehle likho aur test karo (section 4). Attendance grid (employees × shift-days), cell-level status editing, bulk mark, colour coding, manual-entry dot.

**Phase 4 — Payroll engine (isko alag session do)**
> Section 1 ki calculation logic implement karo as a pure function. **Pehle unit tests likho** in cases ke liye:
> - 150k salary, 1 unpaid leave → 145,000
> - Probation employee, 2 leaves → dono deduct, quota chhua tak nahi
> - Confirmed employee, quota 8, 10 leaves → 8 paid, 2 deduct
> - Mid-month joiner
> - 31-day month, zero absence → poori salary
> - Advance installment deduction
> - Public holiday probation mein, toggle on aur off dono
> - **31-day month, 1 tareekh ka joiner → exactly monthly_salary (cap), 103% nahi**
> - **Public holiday jo Sunday pe pade, probation + toggle on → koi deduction nahi**
> - **Probation 15 tareekh ko khatam: 10 aur 20 ko leave → 10 unpaid, 20 paid quota se**
> - **Salary 16 tareekh se badli → 1–15 purani rate, 16–30 nayi rate**
> - **Advance remaining 3,000, installment 10,000 → sirf 3,000 kate, advance close**
> - **Installment > net salary → salary 0 pe ruke, negative nahi, baaki remaining mein rahe**
> - **Regenerate draft do baar → installments duplicate nahi**
>
> Phir generate → review → lock → unlock flow banao. Har step ki audit entry.

**Phase 5 — Advances**
> Advance CRUD, installment schedule, payroll ke saath auto-link, pause/close. Section 11 ke rules exactly.

**Phase 6 — Output**
> Payslip printable page. Monthly salary register with CSV export. Attendance summary report.

**Phase 7 — Polish**
> Dashboard, probation-ending alerts, one-click backup download + restore, last-backup reminder, deploy to Netlify.

---

## 8. Gotchas jo tumhe bite karengi

1. **Timezone.** Tum Pakistan mein ho, holidays USA ke hain. Har date ka "aaj" company timezone mein resolve hona chahiye. Dates ko `YYYY-MM-DD` string mein store karo, JS `Date` mein nahi.

2. **Float money.** `150000 / 30 * 3` JavaScript mein `15000.000000000002` de sakta hai. Integers use karo, ya `Decimal`. Payslip pe rounding ek hi jagah, ek hi rule se.

3. **Payroll lock ka matlab lock.** Lock hone ke baad koi bhi upstream change (salary, attendance) us payslip ko nahi chhoo sakti. Warna pichle mahine ke numbers khud badalte rahenge aur trust khatam.

4. **Probation transition mid-month.** Agar koi 15 tareekh ko confirm hua, to 1–14 ki leaves unpaid aur 15–30 ki paid quota se. Section 1 ka formula ab per-day loop hi hai — month-level shortcut kabhi mat lena, salary change bhi isi loop se handle hoti hai.

5. **Attendance grid performance.** 50 employees × 31 din = 1,550 cells. Virtualize mat karo abhi, lekin har cell pe alag API call bhi mat karo — batch save ya optimistic update.

6. **Employee delete mat karo.** Section 9 wala exit flow use karo. Hard delete sirf tab jab koi record na ho.

7. **Section 5 ka order.** Weekly off → holiday → attendance. Ulta karoge to Sunday wale holidays probation mein deduct honge. Test case likha hua hai Phase 4 mein — chalao.

8. **Regenerate = delete + recreate.** Draft dobara generate karte waqt purane payslips aur us run ke `advance_installments` pehle delete. Warna installment do baar katega aur `remaining_amount` galat ho jayega.


---

## 9. Employee exit / delete — yeh aise chalega

**Employee ko kabhi hard-delete nahi karte.** Wajah simple hai: uske purane payslips, attendance, advances sab us record se linked hain. Delete karo to 6 mahine purani salary report toot jaati hai, aur agar kabhi koi dispute hua ("mujhe March ki salary kam mili") to tumhare paas proof nahi hoga.

Iski jagah **3-state lifecycle**:

| Status | Kya hota hai |
|---|---|
| `active` | Normal. Attendance, payroll, sab chalta hai |
| `exited` | Exit date set. Us date ke baad attendance grid mein nahi dikhta, payroll mein nahi aata. History poori mehfooz |
| `archived` | Exited ko 1 saal baad archive kar do — lists se chhup jaata hai, "Show archived" filter se wapis dikhta hai |

### Exit flow (Employee detail → "Mark as Exited" button)
1. Exit date select karo
2. Exit type: `resigned` / `terminated` / `contract_ended` / `probation_failed`
3. System **final settlement preview** dikhata hai:
   - Exit month ki pro-rated salary (`per_day × days_from_month_start_to_exit_date`, minus us period ki unpaid days)
   - Bacha hua advance sirf **dikhaya** jayega (auto-deduct nahi) — manager chahe to manual adjustment mein daale
   - Manager manually kuch add/deduct kar sakta hai (notice period recovery, bonus, etc.) note ke saath
4. Confirm → status `exited`, exit month ka payroll us employee ke liye is settlement se generate hota hai, phir lock

### Exit month ka payroll run pehle se ho to
| Run status | Kya hoga |
|---|---|
| Nahi hai | Naya run banta hai sirf is employee ke saath (status draft). Baaki employees baad mein "Generate" pe add hote hain — existing payslips ko chhue bina |
| Draft | Us employee ka payslip settlement se **replace**, baaki untouched. Run draft hi rehta hai |
| Locked | **Exit block.** Error: "March payroll locked hai — pehle unlock karo ya exit date April rakho." Guess mat karo, manager faisla kare |

### Hard delete — sirf ek case mein
Agar employee ke paas **zero** attendance, zero payslip, zero advance hai (yani galti se add hua tha) — tab "Delete permanently" button dikhe. Warna button hi na dikhe. Yeh check backend pe enforce karo, sirf UI pe nahi.

### Rehire
Exited employee ko wapis `active` kar sakte ho nayi join date ke saath. Purani history wahi rehti hai, probation dobara shuru hoti hai (company default), leave quota reset.

---

## 10. Decided defaults (yeh sab settings mein badal sakte ho)

Yeh faisle standard practice pe based hain. Koi bhi galat lage to setting se badal do, code chhoone ki zaroorat nahi.

| Cheez | Default | Wajah |
|---|---|---|
| Weekly off | **Saturday + Sunday**, paid | Confirmed |
| Public holiday in probation | **Paid** | Office band hai, employee ki galti nahi. Toggle hai agar ulta chahiye |
| Sick leave quota | **8 per calendar year, 1 January ko reset** | Sabse simple. Mid-year joiner ko bhi poore 8 — quota waise bhi probation ke baad shuru hoti hai, aur per-employee override hai |
| Unused sick leave | **Expire, carry-forward nahi, encash nahi** | Chhoti companies ke liye standard. Encashment scope mein nahi |
| Half-day | **Nahi hai** | Tumhare kehne pe hataya. Baad mein chahiye to `attendance.status` mein ek value add karni hogi |
| Late arrival | **Track nahi hota** | Check-in time record hota hai, lekin koi rule ya flag nahi |
| Advance on exit | **Koi auto-deduction nahi** | Exit pe advance ka remaining sirf dikhaya jayega; manager manually adjustment mein daale ya waive kare |
| Probation duration | **3 months**, per-employee override | Confirmed |
| Currency | **PKR** | Sab companies ki salary PKR mein |
| Check-in | **Public page + manager override dono** | Dono kaam aate hain |
| Missing check-out | **Present count hota hai**, grid mein flag | Bhool jana absent nahi hai |
| Office hours | **8:00 PM – 5:00 AM**, per company | Midnight cross karta hai — section 4 dekho |
| Time format | **12-hour** har jagah | 24-hour kahin nahi |
| Check-in identity | **PIN only** | Naam list public page pe nahi dikhti |
| Manual time entry | **Allowed**, marked | Employee bhool jaye to khud likh de; manager ko amber dot dikhta hai |
| Session expiry | **7 din** | Manager roz login nahi karna chahta, lekin hamesha ke liye bhi nahi |
| Overtime / off-day work | **Track nahi hota** | Off-day check-in record hota hai, paisa nahi banta |

---

## 11. Advances — exact rules

Yeh sab undefined chhodne se payroll mein bugs aate hain. Har case ka jawab:

| Case | Rule |
|---|---|
| Installment kab shuru | `start_month` se. Us se pehle ke payroll mein zero |
| Last installment | `min(installment_amount, remaining_amount)`. Remaining 3,000 aur installment 10,000 → 3,000 kate, `status = closed` |
| Installment > salary | `advance_due = min(installment, base − deduction)`. Net kabhi negative nahi. Jo nahi kata wo `remaining_amount` mein rehta hai, agle month phir try |
| Payroll draft generate | `advance_installments` row banti hai, `remaining_amount` **abhi kam nahi hota** — sirf lock pe |
| Payroll lock | `remaining_amount −= installment`. Zero ho to `status = closed` |
| Payroll unlock | `remaining_amount += installment`, closed tha to wapis `active`. Installment row rehti hai lekin run draft hai |
| Regenerate draft | Us run ki sab installment rows delete, dobara banti hain |
| `paused` | Payroll skip karta hai, remaining wahi rehta hai |
| Employee exit | Kuch auto nahi. Remaining sirf settlement preview mein dikhta hai. Manager manual deduction mein daale ya "Waive" button dabaye (`status = closed`, note zaroori, audit entry) |
| Ek employee ke 2 active advances | Dono ke installments alag-alag katte hain, payslip pe alag lines. Clamp pehle purane advance pe lagta hai |
| Advance edit | Sirf `installment_amount`, `status`, `note` badal sakte hain. `amount` aur `given_on` lock — galat ho to close karke naya banao |
