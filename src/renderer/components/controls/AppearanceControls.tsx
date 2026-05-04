import React from 'react'
import { useAppStore } from '../../stores/appStore'
import { Section, Row, Toggle, ColorPicker, Button } from '../controls/UIKit'

export const AppearanceControls: React.FC = () => {
  const { blankColor, setBlankColor, fullscreen, setFullscreen } = useAppStore()

  const handleFullscreen = (v: boolean) => {
    setFullscreen(v)
    const api = (window as unknown as { api: import('../../../shared/types').IpcApi }).api
    api.setFullscreen(v)
  }

  return (
    <div>
      <Section title="背景色">
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
          画像が配置されていないブランクスペースの色
        </div>
        <ColorPicker
          r={blankColor.r}
          g={blankColor.g}
          b={blankColor.b}
          onChange={(r, g, b) => setBlankColor({ ...blankColor, r, g, b })}
          showAlpha
          alpha={blankColor.a}
          onAlphaChange={a => setBlankColor({ ...blankColor, a })}
        />
        {/* プリセット */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>プリセット</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PRESETS.map(p => (
              <div
                key={p.name}
                title={p.name}
                onClick={() => setBlankColor({ r: p.r, g: p.g, b: p.b, a: 1 })}
                style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: `rgb(${p.r},${p.g},${p.b})`,
                  cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section title="ウィンドウ">
        <Row label="フルスクリーン">
          <Toggle value={fullscreen} onChange={handleFullscreen} />
        </Row>
      </Section>
    </div>
  )
}

const PRESETS = [
  { name: '黒', r: 0, g: 0, b: 0 },
  { name: 'ダークグレー', r: 18, g: 18, b: 18 },
  { name: '白', r: 255, g: 255, b: 255 },
  { name: 'ネイビー', r: 10, g: 15, b: 30 },
  { name: 'ダークパープル', r: 20, g: 10, b: 30 },
  { name: 'ディープブルー', r: 5, g: 10, b: 25 },
  { name: 'ローズブラック', r: 20, g: 8, b: 15 },
]
