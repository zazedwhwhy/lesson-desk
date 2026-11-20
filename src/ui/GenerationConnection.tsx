import React from 'react';

type Props = {connected:boolean; provider:string; model:string; busy:boolean; settings:()=>void};

export function GenerationConnection({connected,provider,model,busy,settings}:Props) {
  const service = provider==='custom'?'自定义服务':provider;
  return <p className="prep-service">
    {connected ? `所选材料将发送至 ${service} · ${model}。`
      : typeof window!=='undefined'&&window.desk ? '请先选择生成所用的模型连接。' : '在桌面程序中连接模型后即可生成。'}
    <button className="prep-text-button" disabled={busy} onClick={settings}>连接设置</button>
  </p>;
}
