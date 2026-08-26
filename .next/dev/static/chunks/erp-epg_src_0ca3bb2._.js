(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/erp-epg/src/components/auth/InactivityProvider.jsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "InactivityProvider",
    ()=>InactivityProvider
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/erp-epg/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$compiler$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/erp-epg/node_modules/next/dist/compiled/react/compiler-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/erp-epg/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/erp-epg/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$src$2f$lib$2f$supabase$2f$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/erp-epg/src/lib/supabase/client.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
const TIMEOUT_MS = 25 * 60 * 1000;
const WARNING_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 30_000;
const ACTIVITY_EVENTS = [
    "mousemove",
    "mousedown",
    "keydown",
    "scroll",
    "touchstart",
    "click"
];
function InactivityProvider(t0) {
    _s();
    const $ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$compiler$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["c"])(13);
    if ($[0] !== "60668563c6c456bb5f84c5b630aa4c881eebbf2e705a6e4a13b6be594bde43f6") {
        for(let $i = 0; $i < 13; $i += 1){
            $[$i] = Symbol.for("react.memo_cache_sentinel");
        }
        $[0] = "60668563c6c456bb5f84c5b630aa4c881eebbf2e705a6e4a13b6be594bde43f6";
    }
    const { children } = t0;
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [secondsLeft, setSecondsLeft] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const lastActivityRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const hasSessionRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    let t1;
    let t2;
    if ($[1] !== router) {
        t1 = ({
            "InactivityProvider[useEffect()]": ()=>{
                const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$src$2f$lib$2f$supabase$2f$client$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createClient"])();
                const doLogout = async function doLogout() {
                    await supabase.auth.signOut();
                    router.push("/login");
                };
                const resetActivity = function resetActivity() {
                    lastActivityRef.current = Date.now();
                    setSecondsLeft(null);
                };
                const attachActivityListeners = function attachActivityListeners() {
                    ACTIVITY_EVENTS.forEach({
                        "InactivityProvider[useEffect() > attachActivityListeners > ACTIVITY_EVENTS.forEach()]": (event)=>window.addEventListener(event, resetActivity, {
                                capture: true,
                                passive: true
                            })
                    }["InactivityProvider[useEffect() > attachActivityListeners > ACTIVITY_EVENTS.forEach()]"]);
                };
                const detachActivityListeners = function detachActivityListeners() {
                    ACTIVITY_EVENTS.forEach({
                        "InactivityProvider[useEffect() > detachActivityListeners > ACTIVITY_EVENTS.forEach()]": (event_0)=>window.removeEventListener(event_0, resetActivity, {
                                capture: true
                            })
                    }["InactivityProvider[useEffect() > detachActivityListeners > ACTIVITY_EVENTS.forEach()]"]);
                };
                const checkInterval = setInterval({
                    "InactivityProvider[useEffect() > setInterval()]": ()=>{
                        if (!hasSessionRef.current) {
                            return;
                        }
                        const elapsed = Date.now() - lastActivityRef.current;
                        if (elapsed >= TIMEOUT_MS) {
                            doLogout();
                        } else {
                            if (elapsed >= TIMEOUT_MS - WARNING_MS) {
                                setSecondsLeft(Math.max(0, Math.ceil((TIMEOUT_MS - elapsed) / 1000)));
                            } else {
                                setSecondsLeft(null);
                            }
                        }
                    }
                }["InactivityProvider[useEffect() > setInterval()]"], CHECK_INTERVAL_MS);
                const { data: t3 } = supabase.auth.onAuthStateChange({
                    "InactivityProvider[useEffect() > supabase.auth.onAuthStateChange()]": (_event, session)=>{
                        const hadSession = hasSessionRef.current;
                        hasSessionRef.current = Boolean(session);
                        if (session && !hadSession) {
                            resetActivity();
                            attachActivityListeners();
                        } else {
                            if (!session && hadSession) {
                                detachActivityListeners();
                                setSecondsLeft(null);
                            }
                        }
                    }
                }["InactivityProvider[useEffect() > supabase.auth.onAuthStateChange()]"]);
                const { subscription } = t3;
                supabase.auth.getSession().then({
                    "InactivityProvider[useEffect() > (anonymous)()]": (t4)=>{
                        const { data: t5 } = t4;
                        const { session: session_0 } = t5;
                        hasSessionRef.current = Boolean(session_0);
                        if (session_0) {
                            resetActivity();
                            attachActivityListeners();
                        }
                    }
                }["InactivityProvider[useEffect() > (anonymous)()]"]);
                return ()=>{
                    clearInterval(checkInterval);
                    detachActivityListeners();
                    subscription.unsubscribe();
                };
            }
        })["InactivityProvider[useEffect()]"];
        t2 = [
            router
        ];
        $[1] = router;
        $[2] = t1;
        $[3] = t2;
    } else {
        t1 = $[2];
        t2 = $[3];
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])(t1, t2);
    let t3;
    let t4;
    if ($[4] !== secondsLeft) {
        t3 = ({
            "InactivityProvider[useEffect()]": ()=>{
                if (secondsLeft === null) {
                    return;
                }
                if (secondsLeft <= 0) {
                    return;
                }
                const tick = setInterval({
                    "InactivityProvider[useEffect() > setInterval()]": ()=>{
                        setSecondsLeft(_InactivityProviderUseEffectSetIntervalSetSecondsLeft);
                    }
                }["InactivityProvider[useEffect() > setInterval()]"], 1000);
                return ()=>clearInterval(tick);
            }
        })["InactivityProvider[useEffect()]"];
        t4 = [
            secondsLeft
        ];
        $[4] = secondsLeft;
        $[5] = t3;
        $[6] = t4;
    } else {
        t3 = $[5];
        t4 = $[6];
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])(t3, t4);
    let t5;
    if ($[7] === Symbol.for("react.memo_cache_sentinel")) {
        t5 = function handleStaySignedIn() {
            lastActivityRef.current = Date.now();
            setSecondsLeft(null);
        };
        $[7] = t5;
    } else {
        t5 = $[7];
    }
    const handleStaySignedIn = t5;
    let t6;
    if ($[8] !== secondsLeft) {
        t6 = secondsLeft !== null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "palacio-card flex w-full max-w-sm flex-col gap-4 p-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-lg font-semibold",
                        children: "Tu sesión está por expirar"
                    }, void 0, false, {
                        fileName: "[project]/erp-epg/src/components/auth/InactivityProvider.jsx",
                        lineNumber: 164,
                        columnNumber: 189
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-sm",
                        children: [
                            "Por inactividad, tu sesión se cerrará en",
                            " ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-semibold",
                                children: secondsLeft
                            }, void 0, false, {
                                fileName: "[project]/erp-epg/src/components/auth/InactivityProvider.jsx",
                                lineNumber: 164,
                                columnNumber: 326
                            }, this),
                            " segundos."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/erp-epg/src/components/auth/InactivityProvider.jsx",
                        lineNumber: 164,
                        columnNumber: 258
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: handleStaySignedIn,
                        className: "palacio-btn-primary px-3 py-2 text-sm",
                        children: "Seguir conectado"
                    }, void 0, false, {
                        fileName: "[project]/erp-epg/src/components/auth/InactivityProvider.jsx",
                        lineNumber: 164,
                        columnNumber: 392
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/erp-epg/src/components/auth/InactivityProvider.jsx",
                lineNumber: 164,
                columnNumber: 119
            }, this)
        }, void 0, false, {
            fileName: "[project]/erp-epg/src/components/auth/InactivityProvider.jsx",
            lineNumber: 164,
            columnNumber: 34
        }, this);
        $[8] = secondsLeft;
        $[9] = t6;
    } else {
        t6 = $[9];
    }
    let t7;
    if ($[10] !== children || $[11] !== t6) {
        t7 = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: [
                children,
                t6
            ]
        }, void 0, true, {
            fileName: "[project]/erp-epg/src/components/auth/InactivityProvider.jsx",
            lineNumber: 172,
            columnNumber: 10
        }, this);
        $[10] = children;
        $[11] = t6;
        $[12] = t7;
    } else {
        t7 = $[12];
    }
    return t7;
}
_s(InactivityProvider, "qAP49XUdP/tscO9EVCGhJWRZBA4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
_c = InactivityProvider;
function _InactivityProviderUseEffectSetIntervalSetSecondsLeft(current) {
    return current === null ? null : Math.max(0, current - 1);
}
var _c;
__turbopack_context__.k.register(_c, "InactivityProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/erp-epg/src/lib/supabase/client.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createClient",
    ()=>createClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/erp-epg/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createBrowserClient$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/erp-epg/node_modules/@supabase/ssr/dist/module/createBrowserClient.js [app-client] (ecmascript)");
;
function createClient() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$erp$2d$epg$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createBrowserClient$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createBrowserClient"])(("TURBOPACK compile-time value", "https://tpibycxcmfasnvleyelz.supabase.co"), ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwaWJ5Y3hjbWZhc252bGV5ZWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTIxODMsImV4cCI6MjEwMjU2ODE4M30.7eLbsaCmNjsmfAK2He_L5NcxymlGjmdzQFvSvLXXJ7Q"));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=erp-epg_src_0ca3bb2._.js.map