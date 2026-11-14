/** Shown instead of the league form while Yahoo sign-in is unavailable. English first, Traditional Chinese below. */
export default function YahooNotice() {
  return (
    <div role="status" className="rounded-[20px] bg-parchment p-6 text-left">
      <p className="callout text-ink-80">
        <span className="font-semibold text-ink">Yahoo sign-in is temporarily unavailable.</span>{" "}
        We&apos;re waiting for Yahoo to approve our access to their Fantasy API, so loading your own league won&apos;t
        work for now. Sorry for the inconvenience! The demo league still works, and we&apos;ll update this page as soon
        as Yahoo gives the green light.
      </p>
      <p lang="zh-Hant" className="callout mt-4 border-t border-hairline pt-4 text-ink-80">
        <span className="font-semibold text-ink">Yahoo 登入暫時無法使用。</span>{" "}
        我們正在等待 Yahoo 核准我們使用其 Fantasy API，因此目前無法載入你自己的聯盟，造成不便，敬請見諒！示範聯盟仍可正常瀏覽，Yahoo 一核准，我們就會更新這個頁面。
      </p>
    </div>
  );
}
