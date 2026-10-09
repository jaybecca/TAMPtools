export async function sendEmail({to,subject,html,text,idempotencyKey}) {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === 'REPLACE_ME') return {sent:false,provider:'not-configured',message:'Email provider is not configured. Configure RESEND_API_KEY before sending.'};
  const from = process.env.EMAIL_FROM || 'TAMPtools <tools@tampconsulting.space>';
  const response = await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},body:JSON.stringify({from,to:[to],subject,html,text})});
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.message || `Email provider returned HTTP ${response.status}`);
  return {sent:true,provider:'resend',id:data.id || null};
}
