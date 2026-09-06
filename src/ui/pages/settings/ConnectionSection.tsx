import { useState } from 'react';
import { runTextTest, runVisionTest, type AiTestResult } from '@/ai/vision';
import type { Messages } from '@/i18n';
import { toAppError } from '@/shared/result';
import type { Settings } from '@/shared/types';
import { NumberField, SettingRow, TestNote, type TestState } from '../../components/fields';
import { useMessages } from '../../hooks/useI18n';
import { ensureEndpointPermission } from './permission';

const EXTRA_BODY_EXAMPLE = '{"thinking": {"type": "disabled"}}';

function describe(m: Messages, result: AiTestResult, kind: 'reply' | 'modelReply'): string {
  const reply = result.reply.slice(0, 120);
  if (kind === 'reply') return result.fromReasoning ? m.connection.replyReasoningOnly(reply) : m.connection.reply(reply);
  return result.fromReasoning ? m.connection.modelReplyReasoningOnly(reply) : m.connection.modelReply(reply);
}

/**
 * 01 AI 端點：網址、金鑰、模型、測試連線、視覺驗證、端點相容性。每一列都寫著它做什麼、預設是什麼。
 * 兩個測試的狀態只有這一章用得到，所以留在這裡；`persistVision` 要由容器提供——
 * 視覺結果必須連同整份 draft 一起存，只寫 ai 會讓容器的 useEffect 把其他編輯還原掉。
 */
export function ConnectionSection({
  draft,
  saved,
  setAi,
  visionActive,
  extraBodyInvalid,
  persistVision,
  onPermissionNote,
}: {
  draft: Settings;
  /** 已存的那一份：比對出哪些欄位改過還沒存 */
  saved: Settings;
  setAi: (p: Partial<Settings['ai']>) => void;
  visionActive: boolean;
  extraBodyInvalid: boolean;
  persistVision: (p: Partial<Settings['ai']>) => Promise<void>;
  onPermissionNote: (message: string) => void;
}) {
  const m = useMessages();
  const c = m.connection;
  const ai = draft.ai;
  const was = saved.ai;
  const [showKey, setShowKey] = useState(false);
  const [textTest, setTextTest] = useState<TestState>({ status: 'idle' });
  const [visionTest, setVisionTest] = useState<TestState>({ status: 'idle' });

  async function ensurePermission(): Promise<boolean> {
    const r = await ensureEndpointPermission(ai.baseUrl);
    if (r.error) onPermissionNote(r.error);
    return r.ok;
  }

  async function testText() {
    setTextTest({ status: 'running' });
    if (!(await ensurePermission())) {
      setTextTest({ status: 'fail', message: c.unauthorized });
      return;
    }
    try {
      const r = await runTextTest(ai);
      setTextTest({ status: 'ok', message: describe(m, r, 'reply') });
    } catch (e) {
      setTextTest({ status: 'fail', message: toAppError(e).message });
    }
  }

  /**
   * 「有回覆」不等於「看得懂圖」——純文字模型也會掰一句。所以測完先把回覆秀出來，
   * 由使用者確認描述對得上那張圖（擴充功能自己的圖示）才算通過。
   */
  async function testVision() {
    setVisionTest({ status: 'running' });
    if (!(await ensurePermission())) {
      setVisionTest({ status: 'fail', message: c.unauthorized });
      setAi({ visionVerifiedAt: undefined });
      return;
    }
    try {
      const r = await runVisionTest(ai);
      if (r.ok) setVisionTest({ status: 'confirm', message: describe(m, r, 'modelReply') });
      else {
        setVisionTest({ status: 'fail', message: c.noReplyContent });
        setAi({ visionVerifiedAt: undefined });
      }
    } catch (e) {
      setVisionTest({ status: 'fail', message: toAppError(e).message });
      await persistVision({ visionSupported: false, visionVerifiedAt: undefined });
    }
  }

  const canTest = !!ai.baseUrl && !!ai.model;

  return (
    <div className="c-body c-pad settings-form">
      <SettingRow
        id="baseUrl"
        label={c.baseUrl.label}
        required
        desc={c.baseUrl.desc}
        def={c.baseUrl.default}
        dirty={ai.baseUrl !== was.baseUrl}
      >
        <input
          id="baseUrl"
          type="url"
          value={ai.baseUrl}
          placeholder={c.baseUrl.default}
          onChange={(e) => setAi({ baseUrl: e.target.value, visionVerifiedAt: undefined })}
        />
      </SettingRow>

      <SettingRow id="apiKey" label={c.apiKey.label} required desc={c.apiKey.desc} dirty={ai.apiKey !== was.apiKey}>
        <div className="row tight" style={{ flexWrap: 'nowrap' }}>
          <input
            id="apiKey"
            type={showKey ? 'text' : 'password'}
            value={ai.apiKey}
            style={{ flex: 1 }}
            onChange={(e) => setAi({ apiKey: e.target.value })}
          />
          <button type="button" className="link" onClick={() => setShowKey((v) => !v)}>
            {showKey ? c.apiKeyHide : c.apiKeyShow}
          </button>
        </div>
      </SettingRow>

      <SettingRow
        id="model"
        label={c.model.label}
        required
        desc={c.model.desc}
        def={c.model.default}
        dirty={ai.model !== was.model}
      >
        <input
          id="model"
          type="text"
          className="mono"
          value={ai.model}
          placeholder={c.model.default}
          onChange={(e) => setAi({ model: e.target.value, visionVerifiedAt: undefined })}
        />
      </SettingRow>

      <SettingRow label={c.test.label} desc={c.test.desc}>
        <div className="row">
          <button
            type="button"
            className="btn"
            disabled={textTest.status === 'running' || !canTest}
            onClick={() => void testText()}
          >
            {textTest.status === 'running' ? c.testing : c.testConnection}
          </button>
          <TestNote state={textTest} />
        </div>
      </SettingRow>

      <SettingRow
        label={c.vision.label}
        desc={c.vision.desc}
        def={c.vision.default}
        dirty={ai.visionSupported !== was.visionSupported}
      >
        <label className="check">
          <input
            type="checkbox"
            className="switch"
            checked={ai.visionSupported}
            onChange={(e) => setAi({ visionSupported: e.target.checked, visionVerifiedAt: undefined })}
          />
          <span>{ai.visionSupported ? c.vision.stateOn : c.vision.stateOff}</span>
          {visionActive && visionTest.status === 'idle' && <span className="tag ok">{c.verified}</span>}
        </label>
        <div className="row">
          <button
            type="button"
            className="btn"
            disabled={!ai.visionSupported || visionTest.status === 'running' || !canTest}
            onClick={() => void testVision()}
          >
            {visionTest.status === 'running' ? c.testingVision : c.testVision}
          </button>
          {visionTest.status === 'confirm' ? (
            <>
              <span className="muted">{visionTest.message}</span>
              <span className="hint inline">{c.doesItMatchQuestion}</span>
              <button
                type="button"
                className="btn small primary"
                onClick={() => {
                  setVisionTest({ status: 'ok', message: c.visionEnabled });
                  void persistVision({ visionSupported: true, visionVerifiedAt: Date.now() }).catch(() => undefined);
                }}
              >
                {c.matchesEnable}
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  setVisionTest({ status: 'fail', message: c.visionDisabled });
                  void persistVision({ visionSupported: false, visionVerifiedAt: undefined }).catch(() => undefined);
                }}
              >
                {c.doesntMatch}
              </button>
            </>
          ) : (
            <TestNote state={visionTest} />
          )}
        </div>
      </SettingRow>

      <SettingRow
        label={c.compat.label}
        desc={c.compat.desc}
        dirty={differs(ai.temperature, was.temperature) || differs(ai.extraBody, was.extraBody)}
      >
        <NumberField
          id="temperature"
          label={c.temperature}
          value={ai.temperature}
          min={0}
          max={2}
          step={0.1}
          placeholder={c.temperatureNotSent}
          hint={c.temperatureHint}
          onChange={(temperature) => setAi(temperature === undefined ? { temperature: undefined } : { temperature })}
        />
        <div className="field">
          <label htmlFor="extraBody">{c.extraBodyLabel}</label>
          <textarea
            id="extraBody"
            className="mono"
            rows={2}
            placeholder={EXTRA_BODY_EXAMPLE}
            value={ai.extraBody ?? ''}
            onChange={(e) => setAi({ extraBody: e.target.value })}
          />
          <span className="hint">
            {c.extraBodyHintBefore} <code>{EXTRA_BODY_EXAMPLE}</code> {c.extraBodyHintAfter}
          </span>
          {extraBodyInvalid && <span className="status-failed">{c.extraBodyInvalid}</span>}
        </div>
      </SettingRow>
    </div>
  );
}

const differs = (a: unknown, b: unknown) => (a ?? '') !== (b ?? '');
