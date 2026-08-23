import { createFileRoute } from "@tanstack/react-router";

import { PublicDocument } from "../components/PublicDocument";

export const Route = createFileRoute("/cookies")({ component: Cookies });

function Cookies() {
	return (
		<PublicDocument
			eyebrow={{ en: "Cookies", hi: "कुकीज़" }}
			title={{ en: "Cookies and local storage", hi: "कुकीज़ और स्थानीय संग्रह" }}
			intro={{
				en: "The platform uses limited browser storage for sign-in, language preference and unfinished work.",
				hi: "मंच साइन-इन, भाषा की पसंद और अधूरे काम के लिए सीमित ब्राउज़र संग्रह का उपयोग करता है।",
			}}
			sections={[
				{
					title: { en: "Essential storage", hi: "आवश्यक संग्रह" },
					paragraphs: [
						{
							en: "Session data keeps you signed in. Language preference keeps the interface in the language you selected. Temporary draft data can protect unfinished input in the current browser.",
							hi: "सत्र डेटा आपको साइन इन रखता है। भाषा की पसंद इंटरफ़ेस को चुनी हुई भाषा में रखती है। अस्थायी मसौदा डेटा इसी ब्राउज़र में अधूरी जानकारी को सुरक्षित रख सकता है।",
						},
					],
				},
				{
					title: { en: "Your control", hi: "आपका नियंत्रण" },
					paragraphs: [
						{
							en: "You can clear browser storage through your browser settings. Doing so may sign you out and remove locally saved progress.",
							hi: "आप ब्राउज़र सेटिंग से संग्रह साफ़ कर सकते हैं। इससे आप साइन आउट हो सकते हैं और स्थानीय रूप से सहेजी प्रगति हट सकती है।",
						},
					],
				},
			]}
		/>
	);
}
