"use client";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-api";
export function LogoutButton(){const router=useRouter();return <button className="text-[9px] text-[#9da69f] hover:text-white" onClick={async()=>{await apiFetch('/api/auth/logout',{method:'POST'});router.push('/');router.refresh()}}>Sign out</button>}
