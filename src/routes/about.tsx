import { createFileRoute } from "@tanstack/react-router";

import { PublicDocument } from "../components/PublicDocument";

export const Route = createFileRoute("/about")({ component: About });

function About() {
	return (
		<PublicDocument
			eyebrow={{ en: "About UGAAP", hi: "UGAAP का परिचय" }}
			title={{
				en: "Grievance access should begin with the citizen's problem.",
				hi: "शिकायत की शुरुआत नागरिक की समस्या से होनी चाहिए।",
			}}
			intro={{
				en: "UGAAP is a prototype for a unified public grievance experience across departments and levels of government.",
				hi: "UGAAP विभागों और सरकार के विभिन्न स्तरों के लिए एकीकृत सार्वजनिक शिकायत अनुभव का प्रोटोटाइप है।",
			}}
			sections={[
				{
					title: { en: "The problem", hi: "समस्या" },
					paragraphs: [
						{
							en: "People often have to understand government structures before they can even choose the right grievance form. That makes the first step harder than it needs to be.",
							hi: "लोगों को सही शिकायत फ़ॉर्म चुनने से पहले सरकारी ढाँचे को समझना पड़ता है। इससे पहला कदम बेवजह कठिन हो जाता है।",
						},
					],
				},
				{
					title: { en: "The approach", hi: "दृष्टिकोण" },
					paragraphs: [
						{
							en: "UGAAP starts with a plain-language description, then helps identify the responsible authority and the information that authority requires.",
							hi: "UGAAP सामान्य भाषा में समस्या के विवरण से शुरू होता है, फिर उत्तरदायी प्राधिकरण और उसकी आवश्यक जानकारी पहचानने में मदद करता है।",
						},
						{
							en: "The same record can support tracking, communication, closure and public performance measures without forcing citizens to learn a different system for every department.",
							hi: "यही रिकॉर्ड ट्रैकिंग, संवाद, शिकायत बंद करने और सार्वजनिक प्रदर्शन मापने में मदद कर सकता है, बिना हर विभाग के लिए अलग व्यवस्था सीखने की जरूरत के।",
						},
					],
				},
			]}
		/>
	);
}
