import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

export type Language = "en" | "hi";

export type InlineCopy = {
	en: string;
	hi: string;
};

export type Copy = InlineCopy | string;

type I18nContextValue = {
	language: Language;
	setLanguage: (language: Language) => void;
	toggleLanguage: () => void;
	text: (copy: InlineCopy) => string;
};

const STORAGE_KEY = "ugaap-language";

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: Readonly<{ children: ReactNode }>) {
	const [language, setLanguageState] = useState<Language>("en");

	useEffect(() => {
		let saved: string | null = null;
		try {
			saved = window.localStorage.getItem(STORAGE_KEY);
		} catch {
			saved = null;
		}
		if (saved === "en" || saved === "hi") {
			setLanguageState(saved);
		}
	}, []);

	useEffect(() => {
		document.documentElement.lang = language === "hi" ? "hi" : "en";
		document.title =
			language === "hi"
				? "यूजीएएपी | शिकायत तक पहुँच"
				: "UGAAP | Grievance access";
		try {
			window.localStorage.setItem(STORAGE_KEY, language);
		} catch {
			// Storage can be disabled by a browser policy. The switch still works for this session.
		}
	}, [language]);

	const setLanguage = useCallback((nextLanguage: Language) => {
		setLanguageState(nextLanguage);
	}, []);

	const toggleLanguage = useCallback(() => {
		setLanguageState((current) => (current === "en" ? "hi" : "en"));
	}, []);

	const value = useMemo(
		() => ({
			language,
			setLanguage,
			toggleLanguage,
			text: (copy: InlineCopy) => copy[language],
		}),
		[language, setLanguage, toggleLanguage],
	);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
	const context = useContext(I18nContext);

	if (!context) {
		throw new Error("useI18n must be used inside I18nProvider");
	}

	return context;
}

export function text(copy: InlineCopy) {
	return copy;
}
