import { createFileRoute } from "@tanstack/react-router";

import { PublicDocument } from "../components/PublicDocument";

export const Route = createFileRoute("/privacy")({ component: Privacy });

function Privacy() {
	return (
		<PublicDocument
			eyebrow={{ en: "Privacy", hi: "गोपनीयता" }}
			title={{
				en: "How information is handled",
				hi: "जानकारी कैसे संभाली जाती है",
			}}
			intro={{
				en: "A grievance may contain personal and sensitive information. The platform should collect only what the process needs and make its use understandable.",
				hi: "शिकायत में निजी और संवेदनशील जानकारी हो सकती है। मंच को केवल प्रक्रिया के लिए जरूरी जानकारी लेनी चाहिए और उसका उपयोग साफ़ बताना चाहिए।",
			}}
			sections={[
				{
					title: { en: "Information you provide", hi: "आपकी दी गई जानकारी" },
					paragraphs: [
						{
							en: "Account details, grievance text, form responses and attachments are used to save, route and manage a grievance.",
							hi: "खाते का विवरण, शिकायत का पाठ, फ़ॉर्म के उत्तर और संलग्नक शिकायत को सहेजने, भेजने और संभालने के लिए उपयोग होते हैं।",
						},
					],
				},
				{
					title: { en: "Public information", hi: "सार्वजनिक जानकारी" },
					paragraphs: [
						{
							en: "Accountability measures should use suitably aggregated or redacted information. Personal details should not be exposed through public grievance views.",
							hi: "जवाबदेही के मापों में समुचित रूप से समेकित या संपादित जानकारी होनी चाहिए। सार्वजनिक शिकायत दृश्य में निजी विवरण सामने नहीं आने चाहिए।",
						},
					],
				},
			]}
		/>
	);
}
