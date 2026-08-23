import { createFileRoute } from "@tanstack/react-router";

import { PublicDocument } from "../components/PublicDocument";

export const Route = createFileRoute("/terms")({ component: Terms });

function Terms() {
	return (
		<PublicDocument
			eyebrow={{ en: "Terms", hi: "नियम" }}
			title={{ en: "Terms of use", hi: "उपयोग के नियम" }}
			intro={{
				en: "These terms explain the basic rules for using the UGAAP prototype.",
				hi: "ये नियम UGAAP प्रोटोटाइप के उपयोग की मूल शर्तें बताते हैं।",
			}}
			sections={[
				{
					title: { en: "Use of the service", hi: "सेवा का उपयोग" },
					paragraphs: [
						{
							en: "Provide information that is accurate to the best of your knowledge. Do not use the service to impersonate another person, interfere with the platform or submit unlawful material.",
							hi: "अपनी जानकारी के अनुसार सही विवरण दें। किसी अन्य व्यक्ति की पहचान का उपयोग, मंच में बाधा या गैरकानूनी सामग्री जमा न करें।",
						},
					],
				},
				{
					title: { en: "Account responsibility", hi: "खाते की जिम्मेदारी" },
					paragraphs: [
						{
							en: "Keep your sign-in details private and review the destination and contents of a grievance before it is filed.",
							hi: "अपनी साइन-इन जानकारी निजी रखें और शिकायत दर्ज होने से पहले उसका प्राधिकरण और सामग्री जाँचें।",
						},
					],
				},
			]}
		/>
	);
}
