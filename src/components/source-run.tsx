"use client";
import { useState } from "react";
import { apiFetch } from "@/lib/client-api";
export function SourceRun({id,enabled}:{id:string;enabled:boolean}){const[msg,setMsg]=useState('');return <div><button className="btn btn-secondary" disabled={!enabled} onClick={async()=>{setMsg('Queueing…');const r=await apiFetch(`/api/sources/${id}/run`,{method:'POST'});const j=await r.json();setMsg(r.ok?`Queued ${j.runId}`:j.error||'Failed')}}>Queue health check</button>{msg&&<p className="mt-1 text-[8px]">{msg}</p>}</div>}
