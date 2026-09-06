import { useState } from 'react';
import { runTextTest, runVisionTest, type AiTestResult } from '@/ai/vision';
import type { Messages } from '@/i18n';
import { toAppError } from '@/shared/result';
import type { Settings } from '@/shared/types';
import { NumberField, TestNote, type TestState } from '../../components/fields';
import { useMessages } from '../../hooks/useI18n';
import { ensureEndpointPermission } from './permission';

const EXTRA_BODY_EXAMPLE = '{"thinking": {"type": "disabled"}}';

function describe(m: Messages, result: AiTestResult, kind: 'reply' | 'modelReply'): string {
  const reply = result.reply.slice(0, 120);
  if (kind === 'reply') return result.fromReasoning ? m.connection.replyReasoningOnly(reply) : m.connection.reply(reply);
  return result.fromReasoning ? m.connection.modelReplyReasoningOnly(reply) : m.connection.modelReply(reply);
}

/**
 * 1 連線：端點、金鑰、模型、視覺驗證與端點相容性。
 * 兩個測試的狀態只有這一段用得到，所以留在這裡；`persistVision` 要由容器提供——
 * 視覺結果必須連同整份 draft 一起存，只寫 ai 會讓容器的 useEffect 把其他編輯還原掉。
 */
export function ConnectionSection({
  draft,
  setAi,
  visionActive,
  extraBodyInvalid,
  persistVision,
  onPermissionNote,
}: {
  draft: Settings;
  setAi: (p: Partial<Settings['ai']>) => void;
  visionActive: boolean;
  extraBodyInvalid: boolean;
  persistVision: (p: Partial<Settings['ai']>) => Promise<void>;
  onPermissionNote: (message: string) => void;
}) {
  const m = useMessages();
  const ai = draft.ai;
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
      setTextTest({ status: 'fail', message: m.connection.unauthorized });
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
   * 由使用者確認描述對得上那張圖（粉色圓底＋白色資料夾）才算通過。
   */
  async function testVision() {
    setVisionTest({ status: 'running' });
    if (!(await ensurePermission())) {
      setVisionTest({ status: 'fail', message: m.connection.unauthorized });
      setAi({ visionVerifiedAt: undefined });
      return;
    }
    try {
      const r = await runVisionTest(ai);
      if (r.ok) setVisionTest({ status: 'confirm', message: describe(m, r, 'modelReply') });
      else {
        setVisionTest({ status: 'fail', message: m.connection.noReplyContent });
        setAi({ visionVerifiedAt: undefined });
      }
    } catch (e) {
      setVisionTest({ status: 'fail', message: toAppError(e).message });
      await persistVision({ visionSupported: false, visionVerifiedAt: undefined });
    }
  }

  return (
    <div className="c-body c-pad settings-form">
      <div className="field">
        <label htmlFor="baseUrl">Base URL</label>
        <input
          id="baseUrl"
          type="url"
          value={ai.baseUrl}
          placeholder="https://api.openai.com/v1"
          onChange={(e) => setAi({ baseUrl: e.target.value, visionVerifiedAt: undefined })}
        />
        <span className="hint">
          {m.connection.urlHint('{Base URL}')} <code>/v1</code>.
        </span>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="apiKey">API Key</label>
          <div className="row tight">
            <input
              id="apiKey"
              type={showKey ? 'text' : 'password'}
              value={ai.apiKey}
              style={{ width: 300 }}
              onChange={(e) => setAi({ apiKey: e.target.value })}
            />
            <button type="button" className="link" onClick={() => setShowKey((v) => !v)}>
              {showKey ? m.connection.apiKeyHide : m.connection.apiKeyShow}
            </button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="model">Model</label>
          <input
            id="model"
            type="text"
            value={ai.model}
            placeholder="gpt-4o-mini"
            onChange={(e) => setAi({ model: e.target.value, visionVerifiedAt: undefined })}
          />
        </div>
      </div>
      <div className="row">
        <button
          type="button"
          className="btn"
          disabled={textTest.status === 'running' || !ai.baseUrl || !ai.model}
          onClick={() => void testText()}
        >
          {textTest.status === 'running' ? m.connection.testing : m.connection.testConnection}
        </button>
        <TestNote state={textTest} />
      </div>
      <div className="divider" />
      <div className="field">
        <label className="check">
          <input
            type="checkbox"
            checked={ai.visionSupported}
            onChange={(e) => setAi({ visionSupported: e.target.checked, visionVerifiedAt: undefined })}
          />
          {m.connection.modelUnderstandsImages}
          {visionActive && visionTest.status === 'idle' && <span className="tag ok">{m.connection.verified}</span>}
        </label>
        <span className="hint">{m.connection.testVisionHint}</span>
      </div>
      <div className="row">
        <button
          type="button"
          className="btn"
          disabled={!ai.visionSupported || visionTest.status === 'running' || !ai.baseUrl || !ai.model}
          onClick={() => void testVision()}
        >
          {visionTest.status === 'running' ? m.connection.testingVision : m.connection.testVision}
        </button>
        {visionTest.status === 'confirm' ? (
          <>
            <span className="muted">{visionTest.message}</span>
            <span className="hint inline">{m.connection.doesItMatchQuestion}</span>
            <button
              type="button"
              className="btn small primary"
              onClick={() => {
                setVisionTest({ status: 'ok', message: m.connection.visionEnabled });
                void persistVision({ visionSupported: true, visionVerifiedAt: Date.now() }).catch(() => undefined);
              }}
            >
              {m.connection.matchesEnable}
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                setVisionTest({ status: 'fail', message: m.connection.visionDisabled });
                void persistVision({ visionSupported: false, visionVerifiedAt: undefined }).catch(() => undefined);
              }}
            >
              {m.connection.doesntMatch}
            </button>
          </>
        ) : (
          <TestNote state={visionTest} />
        )}
      </div>
      <details className="details">
        <summary>{m.connection.endpointCompatibility}</summary>
        <div className="row">
          <NumberField
            id="temperature"
            label={m.connection.temperature}
            value={ai.temperature}
            min={0}
            max={2}
            step={0.1}
            placeholder={m.connection.temperatureNotSent}
            hint={m.connection.temperatureHint}
            onChange={(temperature) => setAi(temperature === undefined ? { temperature: undefined } : { temperature })}
          />
        </div>
        <div className="field">
          <label htmlFor="extraBody">{m.connection.extraBodyLabel}</label>
          <textarea
            id="extraBody"
            rows={2}
            placeholder={EXTRA_BODY_EXAMPLE}
            value={ai.extraBody ?? ''}
            onChange={(e) => setAi({ extraBody: e.target.value })}
          />
          <span className="hint">
            {m.connection.extraBodyHintBefore} <code>{EXTRA_BODY_EXAMPLE}</code> {m.connection.extraBodyHintAfter}
          </span>
          {extraBodyInvalid && <span className="status-failed">{m.connection.extraBodyInvalid}</span>}
        </div>
      </details>
    </div>
  );
}
