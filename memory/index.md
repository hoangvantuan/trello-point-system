# Memory Index

## 🔧 Tools (skill cải tiến + skill mới)
| ID | Tiêu đề | Loại | Status | Tags | File |
|----|---------|------|--------|------|------|

## 🗺️ Maps (workflow lặp lại)
| ID | Tiêu đề | Status | Tags | File |
|----|---------|--------|------|------|
| M-001 | Quy trình subagent-driven-development cho TypeScript + Vitest project | consolidated | subagent, typescript, vitest, workflow | [↗](entries/M-001.md) |
| M-002 | Checklist build/sửa Trello Power-Up — deploy → connector → UI chrome → REST → dashboard | consolidated | trello, power-up, checklist, workflow, deploy, rest-api, ui | [↗](entries/M-002.md) |

## 📌 Facts (context rời rạc)
| ID | Tiêu đề | Status | Tags | File |
|----|---------|--------|------|------|
| F-001 | Cloudflare Workers Builds cần wrangler.jsonc để serve static site | archived | cloudflare, deploy, wrangler | [↗](archive/F-001.md) |
| F-002 | tsconfig noUncheckedIndexedAccess chặn arr[i] trực tiếp, cần guard hoặc assertion | consolidated | typescript, tsconfig, tdd | [↗](entries/F-002.md) |
| F-003 | Trello Power-Up connector URL phải là /index.html, popup mở qua đường dẫn tương đối | consolidated | trello, power-up, deploy | [↗](entries/F-003.md) |
| F-004 | Cloudflare Workers Builds tự động build+deploy mỗi lần git push, URL cố định | archived | cloudflare, deploy, ci-cd | [↗](archive/F-004.md) |
| F-005 | Trello tự render title bar của popup/modal từ {title}, HTML chỉ là thân | archived | trello, power-up, popup, modal, ui | [↗](archive/F-005.md) |
| F-006 | Bar x/4096 là dung lượng pluginData của thẻ, KHÔNG phải tiến độ point | consolidated | trello, power-up, ui, ux, capacity | [↗](entries/F-006.md) |
| F-007 | REST API bulk-fetch pluginData mọi card trong 1 request, gồm cả archive | archived | trello, power-up, rest-api, pluginData, dashboard | [↗](archive/F-007.md) |
| F-008 | pluginData sống sót qua archive; filter=visible loại card archive | archived | trello, power-up, rest-api, pluginData, archive | [↗](archive/F-008.md) |
| F-009 | t.sizeTo() chỉ dùng cho t.popup(); trong t.modal() nó ném PostMessageIO:NotHandled | archived | trello, power-up, modal, popup, sizeTo, debug | [↗](archive/F-009.md) |
| F-010 | Trello REST API helper cần appKey/appName ở cả initialize và iframe | consolidated | trello, power-up, rest-api, dashboard, iframe, appKey | [↗](entries/F-010.md) |
| F-011 | Dashboard responsive cần giữ bảng cuộn trong sheet và cho breakdown bar co lại | consolidated | trello, power-up, dashboard, ui, responsive, css, debug | [↗](entries/F-011.md) |
| F-012 | Security headers cho static-asset Worker đặt qua public/_headers -> dist/_headers | archived | cloudflare, security, headers, csp, hsts, deploy, trello, power-up | [↗](archive/F-012.md) |
| F-013 | Power-Up iframe phải dùng CSP frame-ancestors, KHÔNG dùng X-Frame-Options | archived | trello, power-up, security, csp, iframe, headers | [↗](archive/F-013.md) |
| F-014 | Tab thống kê dạng stock (progress = Log/Est) không được áp filter thời gian vào tử số | consolidated | trello, power-up, dashboard, stats, stock-flow, progress, bug, ux | [↗](entries/F-014.md) |
| F-015 | Nới precision point phải nâng roundTotal đồng bộ; gốc bug là bất đối xứng validatePoint vs validateEstimate | consolidated | point, validate, totals, rounding, decimal, precision, bug | [↗](entries/F-015.md) |
| F-016 | Trello popup vs modal — title bar tự vẽ, modal height cố định, sizeTo chỉ hợp lệ ở popup | consolidated | trello, power-up, popup, modal, sizeTo, ui, debug | [↗](entries/F-016.md) |
| F-017 | REST API bulk-fetch pluginData mọi card 1 request; archive sống sót, filter=all vs visible | consolidated | trello, power-up, rest-api, pluginData, dashboard, archive | [↗](entries/F-017.md) |
| F-018 | Security/CSP headers cho Power-Up static Worker — _headers + frame-ancestors thay X-Frame-Options | consolidated | cloudflare, trello, power-up, security, headers, csp, hsts, iframe, deploy | [↗](entries/F-018.md) |
| F-019 | Cloudflare Workers Builds static site — cần wrangler.jsonc + tự deploy mỗi git push, URL cố định | consolidated | cloudflare, deploy, wrangler, ci-cd | [↗](entries/F-019.md) |
| F-020 | Phân biệt bản chất đại lượng trước khi áp thao tác — stock vs flow, tử/mẫu cùng chiều, hai đầu cùng luật | consolidated | pattern, dashboard, stats, stock-flow, validate, ux, design | [↗](entries/F-020.md) |
| F-021 | Codec pluginData của card — JSON string est + log_<memberId>, trần MAX_CHARS 4096 | consolidated | trello, power-up, pluginData, codec, schema, capacity | [↗](entries/F-021.md) |
