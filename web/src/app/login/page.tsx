"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resendAfter, setResendAfter] = useState(0);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    const supabase = getSupabase();
    supabase?.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/groups");
    });
  }, [router]);

  useEffect(() => {
    if (!resendAfter) return;
    const timer = window.setInterval(() => {
      setResendAfter((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendAfter]);

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    if (resendAfter) return;
    setBusy(true);
    setError("");
    setNotice("");
    const normalized = email.trim().toLowerCase();
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (sendError) {
      setError(`发送失败：${sendError.message}`);
      return;
    }
    setEmail(normalized);
    setStep("code");
    setResendAfter(60);
    setNotice("验证码已发送，请查看邮箱。首次使用会自动创建账号。");
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (verifyError) {
      setError("验证码无效或已过期，请检查后重试。\n" + verifyError.message);
      return;
    }
    router.replace("/groups");
  }

  return (
    <main className={styles.page}>
      <div className={styles.canvas}>
        <Link href="/" className={styles.back}>
          <ArrowLeft size={16} aria-hidden="true" /> 返回首页
        </Link>

        <div className={styles.brand} aria-label="Temori">
          <span className={styles.mark}>t.</span>
          <span>temori</span>
        </div>

        <section className={styles.card} aria-labelledby="login-heading">
          <span className={styles.eyebrow}>TEAM SPACE · 团队空间</span>
          <h1 id="login-heading">进入你的协作空间</h1>
          <p className={styles.subhead}>
            用邮箱接收一次性验证码。任务、讨论和成果会留在团队里，随时接着做。
          </p>

          {!configured ? (
            <div className={styles.setup} role="status">
              <ShieldCheck size={21} aria-hidden="true" />
              <div>
                <strong>Temori 即将开放试用</strong>
                <p>团队空间正在准备中。开放后，你就能用邮箱验证码进入。</p>
              </div>
            </div>
          ) : step === "email" ? (
            <form onSubmit={sendCode} className={styles.form}>
              <label htmlFor="email">邮箱地址</label>
              <div className={styles.inputWrap}>
                <Mail size={19} aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@university.edu"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={busy}
                />
              </div>
              <button className={styles.primary} type="submit" disabled={busy}>
                {busy ? "正在发送…" : "发送验证码"}
                {!busy && <ArrowRight size={17} aria-hidden="true" />}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className={styles.form}>
              <label htmlFor="code">发送到 {email} 的验证码</label>
              <input
                id="code"
                className={styles.codeInput}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="六位验证码"
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                disabled={busy}
              />
              <button className={styles.primary} type="submit" disabled={busy || code.length !== 6}>
                {busy ? "正在验证…" : "验证并进入"}
                {!busy && <ArrowRight size={17} aria-hidden="true" />}
              </button>
              <div className={styles.codeActions}>
                <button type="button" onClick={() => { setStep("email"); setCode(""); setError(""); setResendAfter(0); }}>
                  更换邮箱
                </button>
                <button type="button" disabled={busy || resendAfter > 0} onClick={() => sendCode()}>
                  {resendAfter ? `${resendAfter} 秒后可重发` : "重新发送"}
                </button>
              </div>
            </form>
          )}

          {notice && <p className={styles.notice} role="status">{notice}</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          <p className={styles.footerNote}>登录即表示你同意在你所在的群组中共享自己提交的内容。</p>
        </section>
      </div>
      <aside className={styles.aside} aria-hidden="true">
        <div className={styles.grid} />
        <div className={styles.asideContent}>
          <span>从想法到交付</span>
          <h2>让每一次<br />一起完成，<br />都有迹可循。</h2>
          <div className={styles.trail}>
            <span>任务说明</span><i /><span>按需拆分</span><i /><span>成果提交</span><i /><span>验收完成</span>
          </div>
        </div>
      </aside>
    </main>
  );
}
