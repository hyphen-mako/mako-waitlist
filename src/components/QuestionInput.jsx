"use client";

import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { m } from "framer-motion";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function QuestionInput({
  inputValue,
  onInputChange,
  maxWidth = "700px",
  borderColor = "#3B82F6",
  buttonColor = "#1E3A8A",
  disableInitialAnimation = false,
  compact = false,
  source = "landing",
  inverted = false,
  lockScrollOnFocus = false,
}) {
  const [internalValue, setInternalValue] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [detail, setDetail] = useState({ name: "", phone: "", company: "", note: "" });
  const [detailStatus, setDetailStatus] = useState("idle");
  const [detailMessage, setDetailMessage] = useState("");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const controlled = inputValue !== undefined;
  const email = controlled ? inputValue : internalValue;
  const scrollLockRef = useRef(null);

  const releaseScrollLock = () => {
    if (!scrollLockRef.current) return;
    window.removeEventListener("scroll", scrollLockRef.current);
    scrollLockRef.current = null;
  };

  // iOS scrolls a focused input into view, but the hero is position:sticky so
  // the page runs to the bottom of the sticky track instead. Pin scroll while
  // any field in this form is focused; release when focus leaves the form.
  const lockScroll = () => {
    if (scrollLockRef.current) return;
    const y = window.scrollY;
    const restore = () => {
      if (window.scrollY !== y) window.scrollTo(0, y);
    };
    window.addEventListener("scroll", restore, { passive: true });
    scrollLockRef.current = restore;
  };

  const unlockScroll = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    releaseScrollLock();
  };

  const focusGuards = lockScrollOnFocus ? { onFocus: lockScroll, onBlur: unlockScroll } : {};

  useEffect(
    () => releaseScrollLock,
    [],
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobileViewport(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  const updateEmail = (value) => {
    if (controlled && onInputChange) onInputChange(value);
    else setInternalValue(value);
    if (status !== "idle") {
      setStatus("idle");
      setMessage("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setStatus("error");
      setMessage("이메일 주소를 다시 확인해주세요.");
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          source,
          website: formData.get("website"),
        }),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.message || "신청을 완료하지 못했어요.");

      if (controlled && onInputChange) onInputChange("");
      else setInternalValue("");
      setSubmittedEmail(normalizedEmail);
      setDetailStatus("idle");
      setDetailMessage("");
      releaseScrollLock();
      if (result.duplicate) {
        setStatus("duplicate");
        setMessage("이미 신청된 이메일이에요. 오픈 이벤트 초대를 기다려주세요.");
      } else {
        setStatus("detail");
        setMessage("");
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.");
    }
  };

  const updateDetail = (key) => (event) =>
    setDetail((current) => ({ ...current, [key]: event.target.value }));

  const handleDetailSubmit = async (event) => {
    event.preventDefault();
    if (detailStatus === "submitting") return;
    setDetailStatus("submitting");
    setDetailMessage("");
    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/waitlist-detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: submittedEmail,
          ...detail,
          website: formData.get("website"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "전송에 실패했어요.");
      setStatus("done");
      setMessage("신청이 완료됐어요. 카드뉴스 무한 생성 이벤트 초대를 가장 먼저 보내드릴게요.");
    } catch (error) {
      setDetailStatus("error");
      setDetailMessage(error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.");
    }
  };

  if (status === "detail" || status === "duplicate" || status === "done") {
    const detailContent = (
      <m.div
        className={`waitlist-detail ${compact ? "waitlist-detail--compact" : ""} ${lockScrollOnFocus ? "waitlist-detail--hero" : ""}`}
        style={{ maxWidth }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="waitlist-detail-card">
          {status === "detail" ? (
            <form className="waitlist-detail-form" onSubmit={handleDetailSubmit}>
              <p className="waitlist-detail-title">거의 다 됐어요! 추가 정보를 입력하면 신청이 완료됩니다</p>
              <input
                type="email"
                className="waitlist-detail-input"
                value={submittedEmail}
                readOnly
                aria-label="신청된 이메일"
              />
              <div className="waitlist-detail-grid">
                <input
                  className="waitlist-detail-input"
                  placeholder="이름"
                  aria-label="이름"
                  autoComplete="name"
                  maxLength={60}
                  required
                  value={detail.name}
                  onChange={updateDetail("name")}
                />
                <input
                  className="waitlist-detail-input"
                  placeholder="연락처"
                  aria-label="연락처"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={40}
                  required
                  value={detail.phone}
                  onChange={updateDetail("phone")}
                />
                <input
                  className="waitlist-detail-input"
                  placeholder="회사/브랜드명 (선택)"
                  aria-label="회사 또는 브랜드명 (선택)"
                  autoComplete="organization"
                  maxLength={80}
                  value={detail.company}
                  onChange={updateDetail("company")}
                />
              </div>
              <textarea
                className="waitlist-detail-input waitlist-detail-textarea"
                placeholder="만들고 싶은 콘텐츠나 궁금한 점 (선택)"
                aria-label="만들고 싶은 콘텐츠나 궁금한 점 (선택)"
                maxLength={500}
                value={detail.note}
                onChange={updateDetail("note")}
              />
              <input type="hidden" name="website" value="" />
              <div className="waitlist-detail-actions">
                <button type="submit" className="waitlist-submit waitlist-detail-submit" disabled={detailStatus === "submitting"}>
                  <span>{detailStatus === "submitting" ? "전송 중" : "신청 완료하기"}</span>
                  <i className={detailStatus === "submitting" ? "ri-loader-4-line waitlist-spinner" : "ri-arrow-right-line"} aria-hidden="true" />
                </button>
              </div>
              {detailMessage ? (
                <div className="waitlist-feedback" aria-live="polite">
                  <span className="waitlist-feedback--error">
                    <i className="ri-error-warning-line" aria-hidden="true" />
                    {detailMessage}
                  </span>
                </div>
              ) : null}
              <p className="waitlist-detail-privacy">
                제출 시 <a href="/privacy">개인정보처리방침</a>에 동의하게 됩니다.
              </p>
            </form>
          ) : (
            <div className="waitlist-feedback waitlist-feedback--success" role="status">
              <span>
                <i className="ri-checkbox-circle-line" aria-hidden="true" />
                {message}
              </span>
            </div>
          )}
        </div>
      </m.div>
    );

    return lockScrollOnFocus && isMobileViewport
      ? createPortal(detailContent, document.body)
      : detailContent;
  }

  return (
    <m.form
      onSubmit={handleSubmit}
      {...focusGuards}
      className={`waitlist-form ${compact ? "waitlist-form--compact" : ""} ${inverted ? "waitlist-form--inverted" : ""}`}
      style={{ maxWidth }}
      initial={disableInitialAnimation ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={disableInitialAnimation ? { duration: 0 } : { duration: 0.6, ease: "easeOut", delay: 0.65 }}
    >
      <div className="waitlist-control" style={{ borderColor }}>
        <i className="ri-mail-line waitlist-mail-icon" aria-hidden="true" />
        <input
          type="email"
          name="email"
          value={email}
          onChange={(event) => updateEmail(event.target.value)}
          autoComplete="email"
          inputMode="email"
          required
          aria-label="웨잇리스트 이메일"
          aria-describedby={`${source}-waitlist-feedback`}
          placeholder="이메일 주소를 입력하세요"
          className="waitlist-input"
        />
        <input type="hidden" name="website" value="" />
        <m.button
          type="submit"
          disabled={status === "submitting"}
          className="waitlist-submit"
          style={{ backgroundColor: buttonColor }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
        >
          <span>{status === "submitting" ? "신청 중" : "웨잇리스트"}</span>
          <i className={status === "submitting" ? "ri-loader-4-line waitlist-spinner" : "ri-arrow-right-line"} aria-hidden="true" />
        </m.button>
      </div>
      <div id={`${source}-waitlist-feedback`} className="waitlist-feedback" aria-live="polite">
        {message ? (
          <span className={status === "error" ? "waitlist-feedback--error" : "waitlist-feedback--success"}>
            <i className={status === "error" ? "ri-error-warning-line" : "ri-checkbox-circle-line"} aria-hidden="true" />
            {message}
          </span>
        ) : !compact ? (
          <span>
            신청 시 <a href="/privacy">개인정보처리방침</a>에 동의하게 됩니다.
          </span>
        ) : null}
      </div>
    </m.form>
  );
}

export default memo(QuestionInput);
