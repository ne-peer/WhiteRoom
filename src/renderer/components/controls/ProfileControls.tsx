import React, { useState } from 'react'
import { useAppStore } from '../../stores/appStore'
import { Section, Button } from '../controls/UIKit'
import type { IpcApi } from '../../../shared/types'

export const ProfileControls: React.FC = () => {
  const { exportProfile, importProfile, resetProfile } = useAppStore()
  const [profileName, setProfileName] = useState('MyProfile')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const api = (window as unknown as { api: IpcApi }).api

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleSave = async () => {
    const profile = exportProfile(profileName)
    const result = await api.saveProfile(profile)
    if (result.success) showMsg('ok', '✓ 保存完了')
    else showMsg('err', `✗ 保存失敗: ${result.error ?? ''}`)
  }

  const handleLoad = async () => {
    const result = await api.loadProfile()
    if (result.success && result.profile) {
      importProfile(result.profile)
      setProfileName(result.profile.name)
      showMsg('ok', '✓ 読み込み完了')
    } else if (!result.success && result.error) {
      showMsg('err', `✗ 読み込み失敗: ${result.error}`)
    }
  }

  const handleReset = () => {
    if (confirm('現在の設定をすべてリセットしますか？')) {
      resetProfile()
      showMsg('ok', '✓ リセット完了')
    }
  }

  return (
    <div>
      <Section title="プロファイル名">
        <input
          type="text"
          value={profileName}
          onChange={e => setProfileName(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            color: '#fff',
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
          placeholder="プロファイル名を入力"
        />
      </Section>

      <Section title="エクスポート / インポート">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button variant="primary" onClick={handleSave}>
            ↑ JSONとして保存（エクスポート）
          </Button>
          <Button variant="secondary" onClick={handleLoad}>
            ↓ JSONから読み込む（インポート）
          </Button>
          <Button variant="danger" onClick={handleReset}>
            ↺ 設定をリセット
          </Button>
        </div>
      </Section>

      {/* メッセージ */}
      {message && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          borderRadius: 8,
          fontSize: 12,
          background: message.type === 'ok' ? 'rgba(80,200,120,0.15)' : 'rgba(255,80,80,0.15)',
          color: message.type === 'ok' ? '#80e8a0' : '#ff8080',
          border: `1px solid ${message.type === 'ok' ? 'rgba(80,200,120,0.3)' : 'rgba(255,80,80,0.3)'}`,
        }}>
          {message.text}
        </div>
      )}

      <Section title="現在のプロファイル情報">
        <ProfileInfo />
      </Section>
    </div>
  )
}

const ProfileInfo: React.FC = () => {
  const { grid, cells } = useAppStore()
  const activeCells = cells.filter(c => c.folder !== null)

  return (
    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 2 }}>
      <div>グリッド: {grid.cols} × {grid.rows}</div>
      <div>アクティブセル: {activeCells.length} / {cells.length}</div>
      <div>スライドショー: {cells.filter(c => c.slideshow.enabled).length}セル</div>
    </div>
  )
}
