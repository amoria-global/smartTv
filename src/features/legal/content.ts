/**
 * In-app legal text for the TV app.
 *
 * TV stores (Samsung, LG, Google Play, Fire TV) require the Privacy Policy
 * and Terms to be readable *inside* the app — a plain `Linking.openURL` to a
 * website is not enough on a TV, which usually has no browser to hand off to.
 * So the full text lives here and is rendered on-screen by `pages/legal.tsx`,
 * with a QR code to the canonical web version for anyone who'd rather read it
 * on their phone.
 *
 * This is the human-readable summary shown on the TV; the canonical, legally
 * binding version is the one published at connekyt.com. Keep the two in sync.
 */

export const LEGAL_LAST_UPDATED = 'July 21, 2026';
export const LEGAL_PRIVACY_URL = 'https://connekyt.com/user/privacy-policy';
export const LEGAL_TERMS_URL = 'https://connekyt.com/user/terms-of-service';
export const LEGAL_CONTACT_EMAIL = 'support@connekyt.com';

export type LegalSection = { heading: string; body: string };

export const PRIVACY_SECTIONS: LegalSection[] = [
    {
        heading: 'Who we are',
        body:
            'Connekyt is operated by Amoria Global Tech. This app lets you watch live and recorded events, book photographers, find photos of yourself, and support creators through donations, using the same Connekyt account you use on the web and mobile apps. This summary explains what the TV app does with your information.',
    },
    {
        heading: 'Information we use on this TV',
        body:
            'When you sign in, the app uses your account details — your name, email, profile picture, and account type — to show your content and personalise Home. As you use the app it records which events you open and how far you watched, so we can resume playback and improve recommendations. Each TV you sign into is registered to your account as a paired device, which you can see and remove under Settings › Devices.',
    },
    {
        heading: 'Face photo search',
        body:
            'If you use Face Photo Search, a photo you provide is matched against event galleries to find pictures of you. This matching happens on Connekyt servers; the TV app itself does not store your face data. You can request deletion of your account and associated data at any time by contacting us.',
    },
    {
        heading: 'Payments and donations',
        body:
            'The TV never collects card or payment details. When you reserve a paid event, pay to watch, or donate, the app shows a QR code that you scan to complete the payment securely on your phone or computer through Connekyt’s payment provider. Payment card data is handled entirely by that provider, not by this app.',
    },
    {
        heading: 'What we do not do',
        body:
            'We do not sell your personal information. We do not use the TV’s camera or microphone except when you explicitly start a feature that needs it (for example, voice search, if enabled). We do not show third-party advertising trackers in this app.',
    },
    {
        heading: 'Data retention and your choices',
        body:
            'Your account information is kept for as long as your account is active. You can update your profile, change your password, manage notifications, and delete paired devices from Settings, or manage your full account from the Connekyt dashboard on the web. To delete your account entirely, contact us and we will remove your personal data, subject to any records we must keep by law.',
    },
    {
        heading: 'Children',
        body:
            'Connekyt is not directed to children under 13. The app includes an optional parental PIN that restricts Settings and can hide selected categories. If you believe a child has provided us personal information, contact us and we will delete it.',
    },
    {
        heading: 'Contact us',
        body:
            'For any privacy question or request, email ' + LEGAL_CONTACT_EMAIL + '. The full, legally binding Privacy Policy is published at connekyt.com — scan the QR code on this screen to read it on your phone.',
    },
];

export const TERMS_SECTIONS: LegalSection[] = [
    {
        heading: 'Accepting these terms',
        body:
            'By using the Connekyt TV app you agree to these terms and to the full Terms of Service published at connekyt.com. If you do not agree, please do not use the app. Your use of the app is also governed by our Privacy Policy.',
    },
    {
        heading: 'Your account',
        body:
            'You need a Connekyt account to sign in on this TV, and you are responsible for keeping your sign-in secure. Each TV you use is registered to your account; you can remove a TV at any time under Settings › Devices, or sign out of every device at once. Do not share your account in a way that violates these terms.',
    },
    {
        heading: 'Content and streaming',
        body:
            'Events, photos, and other content are owned by the creators and organisers who publish them, or by their licensors. You may watch content you have access to for personal, non-commercial use. You may not record, copy, re-broadcast, or redistribute streams or photos without permission. Availability of any event may change, and some events require a fee or an invitation to watch.',
    },
    {
        heading: 'Purchases, fees and donations',
        body:
            'Paid events, pay-to-watch access, and donations are completed on your phone or computer through Connekyt’s payment provider — the TV only displays a QR code to start the transaction. Prices and fees are shown before you pay. Except where required by law or stated at the point of sale, payments and donations are non-refundable. Donations support the creator or cause you choose and are not investments.',
    },
    {
        heading: 'Acceptable use',
        body:
            'You agree not to misuse the app: no attempting to break, overload, or reverse-engineer the service; no accessing content you have not been granted; and no using the app to infringe others’ rights or break the law. We may suspend or end access that violates these terms.',
    },
    {
        heading: 'Service “as is”',
        body:
            'The app is provided on an “as is” and “as available” basis. We work to keep streams reliable, but we do not guarantee that every event will be uninterrupted or error-free, and playback quality depends on your TV and internet connection. To the fullest extent permitted by law, Connekyt is not liable for indirect or incidental damages arising from your use of the app.',
    },
    {
        heading: 'Changes and contact',
        body:
            'We may update these terms as the service evolves; the current version is always the one published at connekyt.com. For questions about these terms, email ' + LEGAL_CONTACT_EMAIL + '. Scan the QR code on this screen to read the full Terms of Service on your phone.',
    },
];
