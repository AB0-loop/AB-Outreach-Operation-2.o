"use client";
export function csrfToken() { return document.cookie.split("; ").find(x => x.startsWith("aurum_csrf="))?.split("=")[1] ?? ""; }
export async function apiFetch(url: string, init: RequestInit = {}) { return fetch(url, { ...init, headers: { "x-csrf-token": csrfToken(), ...(init.headers ?? {}) } }); }
