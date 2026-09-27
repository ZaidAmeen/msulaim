<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules

- Google Sheets is the database (spreadsheet "VoucherLink Database", sheets `ClientVouchers` and `DeliveryVouchers`); all access goes through `src/lib/sheets.server.ts` via the connector gateway, so credentials never reach the browser.
- Sheet reads/writes are exposed only through server functions in `src/lib/vouchers.functions.ts`; components use `boardQuery` from `src/lib/voucher-queries.ts`.
