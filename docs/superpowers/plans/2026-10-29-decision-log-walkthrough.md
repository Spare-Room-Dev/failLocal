# Decision log walkthrough, Release 2

The owner's review of every entry in `docs/decisions.md` before Release 2 (spec §9b). Claude summarised each entry in plain English, and the owner accepted it or changed it. Each change is also written into that entry's "Owner change" line (spec §9c). Once every section is done, the "How I built this" sentence "I reviewed each one and accepted or changed it" is true.

| Section | Entries | Date | Outcome |
|---|---|---|---|
| 1. How the model works | D-001–D-013, D-093 (14) | 29 Oct 2026 | All accepted. D-004 (optimistic detect-and-revoke), D-007 (all controls assumed to work) and D-009 (Perth link over the corporate network) were each asked about separately and accepted. |
| 2. Process tiers | D-014–D-023 (10) | 29 Oct 2026 | All accepted. D-023 (payroll low, for production only) and D-022 (work orders medium) were each asked about separately and accepted. |
| 3. Dependencies | D-024–D-040 (17) | 29 Oct 2026 | All accepted. D-030 (control-room operators use corporate cloud logins) and D-040 (rail slows rather than stops without Perth) were each asked about separately and accepted. |
| 4. Vendor reach | D-097, D-098 (2) | 29 Oct 2026 | All accepted. |
| 5. Manual workarounds | D-041–D-045 (5) | 29 Oct 2026 | All accepted. D-041 (phone and email ordering holds 3 days, the number that drives the S1 projection's revenue at risk) was asked about separately and accepted. |
| 6. Post-restore holds | D-094, D-095 (2) | 29 Oct 2026 | All accepted. |
| 7. Outage limits and recovery targets | D-046–D-055 (10) | 29 Oct 2026 | All accepted. D-055 (rail tolerates one day, the only limit not derived from a stock) was asked about separately and accepted. |
| 8. Stocks | D-056–D-068, D-091, D-092 (15) | 29 Oct 2026 | All accepted. D-056 (7 days of diesel) and D-066 (3-day product stockpile) were each asked about separately and accepted. |
| 9. Controls (prepared site) | D-069–D-076, D-096 (9) | 29 Oct 2026 | All accepted. D-072 (2-day own ERP restore), D-073 (2-hour site takeover of the fleet) and D-075 (30-minute vendor revoke) were asked about separately and accepted. |
| 10. Scenarios | D-077–D-087 (11) | 29 Oct 2026 | All accepted. D-084 (12-hour crusher outage after an unnoticed setpoint change) was asked about separately and accepted. |
| 11. Production | D-088–D-090 (3) | 29 Oct 2026 | All accepted. The price basis (China CFR benchmark on wet tonnes, so revenue at risk reads high; D-088, D-089) was asked about separately and accepted. |
| 12. The website | D-099–D-115 (17) | 29 Oct 2026 | All accepted. D-115 is to be updated in Task 5 for the owner's switch from Cloudflare Pages to Vercel, which gets its own entry recorded as the owner's decision. |

**Result:** all 115 entries reviewed on 29 Oct 2026, all accepted as written, none changed in this walkthrough. Earlier owner changes (D-008, D-011, D-093, D-094, D-095, D-096, D-097, D-098, made on 26 Oct 2026) stand in their entries' "Owner change" lines.
