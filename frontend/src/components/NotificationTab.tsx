import React, { useState, useEffect } from 'react';
import { Bell, Send, CheckCircle2, AlertCircle, HelpCircle, ExternalLink } from 'lucide-react';
import { NotificationSettings } from '../App';

interface NotificationTabProps {
  settings: NotificationSettings;
  onSaveSettings: (newSettings: NotificationSettings) => Promise<boolean>;
}

const NotificationTab: React.FC<NotificationTabProps> = ({ settings, onSaveSettings }) => {
  const [lineToken, setLineToken] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [notifyTime, setNotifyTime] = useState('14:00');
  const [enabled, setEnabled] = useState(false);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  // Feedback alerts states
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync state when props load
  useEffect(() => {
    if (settings) {
      setLineToken(settings.lineToken || '');
      setDiscordWebhook(settings.discordWebhook || '');
      setNotifyTime(settings.notifyTime || '14:00');
      setEnabled(settings.enabled || false);
    }
  }, [settings]);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);

    const payload: NotificationSettings = {
      lineToken: lineToken.trim(),
      discordWebhook: discordWebhook.trim(),
      notifyTime: notifyTime || '14:00',
      enabled: enabled,
    };

    try {
      const success = await onSaveSettings(payload);
      if (success) {
        setAlert({ type: 'success', message: '通知設定已成功儲存！' });
      } else {
        setAlert({ type: 'error', message: '儲存設定失敗，請確認與伺服器之連線' });
      }
    } catch (err) {
      setAlert({ type: 'error', message: '儲存發生錯誤' });
    } finally {
      setSaving(false);
    }
  };

  // Trigger manual test notification
  const handleTestNotification = async () => {
    setTesting(true);
    setAlert(null);

    try {
      const response = await fetch('/api/notify/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();

      if (response.ok && result.success) {
        let msg = '測試通知發送成功！';
        const details = [];
        if (result.details.lineSuccess) details.push('LINE Notify');
        if (result.details.discordSuccess) details.push('Discord');
        
        setAlert({
          type: 'success',
          message: `${msg} (${details.join('、')} 已順利收件)`
        });
      } else {
        setAlert({
          type: 'error',
          message: result.message || '測試通知發送失敗'
        });
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: '連線錯誤，無法發送測試通知'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h2>每日收盤通知設定</h2>
          <p>設定您的通訊服務 Token，每天下午收盤後自動獲取庫存市值回報</p>
        </div>
      </div>

      {alert && (
        <div
          style={{
            padding: '1rem 1.25rem',
            background: alert.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${alert.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            borderRadius: '12px',
            color: alert.type === 'success' ? '#4ade80' : '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            fontSize: '0.95rem'
          }}
        >
          {alert.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{alert.message}</span>
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Toggle Switch to activate daily report */}
        <div className="switch-container">
          <div className="switch-label">
            <span className="switch-title">啟動每日收盤回報</span>
            <span className="switch-desc">開啟後，系統將在設定的時間自動彙整持股並發送通知</span>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="grid-cols-2" style={{ marginBottom: '1.5rem' }}>
          {/* Time Picker */}
          <div className="glass-card">
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bell size={14} color="var(--accent-primary)" />
                <span>每日發送時間</span>
              </label>
              <input
                type="time"
                className="form-input"
                value={notifyTime}
                onChange={(e) => setNotifyTime(e.target.value)}
                required
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'block' }}>
                * 台股收盤時間為 13:30，最終定價於 14:00 前完成，建議設定於 **14:00** 以後發送。 (時間以伺服器為準)
              </span>
            </div>
          </div>

          {/* Quick instructions or helper card */}
          <div className="glass-card" style={{ background: 'rgba(37,99,235,0.03)', borderColor: 'rgba(37,99,235,0.1)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <HelpCircle size={16} />
              <span>通知管道設定指引</span>
            </h4>
            <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li>本系統同時支援 **LINE Notify** 與 **Discord Webhook**。</li>
              <li>您可以僅設定其中一個，也可以兩者皆設定以獲得雙重保障。</li>
              <li>設定完成後，您可以點擊最下方的 **「發送測試通知」** 確認您的管道配置正確。</li>
            </ul>
          </div>
        </div>

        {/* Channels Configuration */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Channel 1: LINE Notify */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>LINE Notify 權杖 (Token)</label>
              <a
                href="https://notify-bot.line.me/zh_TW/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <span>取得 LINE Token</span>
                <ExternalLink size={12} />
              </a>
            </div>
            <input
              type="password"
              className="form-input"
              placeholder="請貼上您的 LINE Notify Token"
              value={lineToken}
              onChange={(e) => setLineToken(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
              將 LINE Notify 官方機器人加到您的個人或群組聊天室，即可每日免費接收圖表資產狀況！
            </span>
          </div>

          {/* Channel 2: Discord Webhook */}
          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
            <label className="form-label">Discord 頻道 Webhook URL</label>
            <input
              type="text"
              className="form-input"
              placeholder="https://discord.com/api/webhooks/..."
              value={discordWebhook}
              onChange={(e) => setDiscordWebhook(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
              在您 Discord 伺服器之頻道設定中，點選「整合 &gt; Webhook &gt; 建立 Webhook」，複製其 URL 並貼在此處。
            </span>
          </div>
        </div>

        {/* Actions bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestNotification}
            disabled={testing || saving || (!lineToken && !discordWebhook)}
            style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <Send size={16} />
            <span>{testing ? '發送測試中...' : '發送測試通知'}</span>
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || testing}
            style={{ minWidth: '160px' }}
          >
            {saving ? '儲存中...' : '儲存通知設定'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NotificationTab;
