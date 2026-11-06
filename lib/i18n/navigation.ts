import {
  Activity,
  ArrowLeftRight,
  Bell,
  Building2,
  CandlestickChart,
  Coins,
  FlaskConical,
  Gauge,
  Layers,
  Newspaper,
  Rocket,
  ScanSearch,
  Star,
  Sunrise,
  ShieldAlert,
  LineChart,
  type LucideIcon,
  Sigma,
  FileBarChart,
  Briefcase,
  Sparkles,
  Radio,
  BookOpen,
  Network,
} from "lucide-react";
import { SupportedLocale, Dictionary } from "./types";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  hint: string;
};

export type NavGroup = {
  key: "markets" | "companies" | "research";
  label: string;
  blurb: string;
  items: NavItem[];
};

interface GroupMeta {
  label: string;
  blurb: string;
}

const GROUP_TITLES: Record<SupportedLocale, { markets: GroupMeta; companies: GroupMeta; research: GroupMeta }> = {
  en: {
    markets: { label: "Markets", blurb: "What the market is doing now" },
    companies: { label: "Companies", blurb: "Listed, unlisted and about to list" },
    research: { label: "Research", blurb: "Models, screens and the record" },
  },
  hi: {
    markets: { label: "बाज़ार (Markets)", blurb: "बाज़ार का वर्तमान रुझान एवं लाइव गति" },
    companies: { label: "कंपनियाँ (Companies)", blurb: "सूचीबद्ध, गैर-सूचीबद्ध और आगामी आईपीओ" },
    research: { label: "अनुसंधान (Research)", blurb: "क्वांट मॉडल, स्क्रीनर एवं प्रमाणित रिकॉर्ड" },
  },
  bn: {
    markets: { label: "বাজার (Markets)", blurb: "বাজারের বর্তমান অবস্থা ও রিয়েলটাইম গতি" },
    companies: { label: "কোম্পানি (Companies)", blurb: "তালিকাভুক্ত, অতালিকাভুক্ত এবং আসন্ন আইপিও" },
    research: { label: "গবেষণা (Research)", blurb: "কোয়ান্ট মডেল, স্ক্রিনার ও ট্র্যাক রেকর্ড" },
  },
  gu: {
    markets: { label: "બજાર (Markets)", blurb: "બજારની વર્તમાન સ્થિતિ અને લાઇવ વલણ" },
    companies: { label: "કંપનીઓ (Companies)", blurb: "લિસ્ટેડ, અનલિસ્ટેડ અને આગામી આઈપીઓ" },
    research: { label: "સંશોધન (Research)", blurb: "ક્વોન્ટ મોડેલ્સ, સ્ક્રીનર્સ અને ટ્રેક રેકોર્ડ" },
  },
  mr: {
    markets: { label: "बाजार (Markets)", blurb: "बाजाराची सध्याची स्थिती आणि कल" },
    companies: { label: "कंपन्या (Companies)", blurb: "नोंदणीकृत, विनानोंदणीकृत आणि आगामी आयपीओ" },
    research: { label: "संशोधन (Research)", blurb: "मॉडेल्स, स्क्रीनर्स आणि ट्रॅक रेकॉर्ड" },
  },
  ta: {
    markets: { label: "சந்தை (Markets)", blurb: "தற்போதைய சந்தை போக்கு மற்றும் நகர்வுகள்" },
    companies: { label: "நிறுவனங்கள் (Companies)", blurb: "பட்டியலிடப்பட்ட, பட்டியலிடப்படாத நிறுவனங்கள்" },
    research: { label: "ஆராய்ச்சி (Research)", blurb: "மாதிரிகள், திரையிடல் மற்றும் பதிவுகள்" },
  },
  te: {
    markets: { label: "మార్కెట్లు (Markets)", blurb: "మార్కెట్ ప్రస్తుత స్థితి మరియు ట్రెండ్స్" },
    companies: { label: "కంపెనీలు (Companies)", blurb: "లిస్టెడ్, అన్‌లిస్టెడ్ మరియు రాబోయే ఐపీఓలు" },
    research: { label: "పరిశోధన (Research)", blurb: "మోడల్స్, స్క్రీనర్స్ మరియు ట్రాక్ రికార్డ్" },
  },
  kn: {
    markets: { label: "ಮಾರುಕಟ್ಟೆಗಳು (Markets)", blurb: "ಮಾರುಕಟ್ಟೆಯ ಪ್ರಸ್ತುತ ಪ್ರವೃತ್ತಿ ಮತ್ತು ಚಲನೆಗಳು" },
    companies: { label: "ಕಂಪನಿಗಳು (Companies)", blurb: "ಲಿಸ್ಟೆಡ್, ಅನ್‌ಲಿಸ್ಟೆಡ್ ಮತ್ತು ಮುಂಬರುವ ಐಪಿಒ" },
    research: { label: "ಸಂಶೋಧನೆ (Research)", blurb: "ಮಾದರಿಗಳು, ಸ್ಕ್ರೀನರ್‌ಗಳು ಮತ್ತು ದಾಖಲೆಗಳು" },
  },
  ml: {
    markets: { label: "വിപണികൾ (Markets)", blurb: "വിപണിയുടെ നിലവിലെ സ്ഥിതിയും ചലനങ്ങളും" },
    companies: { label: "കമ്പനികൾ (Companies)", blurb: "ലിസ്റ്റ് ചെയ്തതും അൺലിസ്റ്റഡ് കമ്പനികളും" },
    research: { label: "ഗവേഷണം (Research)", blurb: "ക്വാണ്ട് മോഡലുകൾ, സ്ക്രീനറുകൾ, റെക്കോർഡുകൾ" },
  },
  pa: {
    markets: { label: "ਬਜ਼ਾਰ (Markets)", blurb: "ਬਜ਼ਾਰ ਦੀ ਮੌਜੂਦਾ ਸਥਿਤੀ ਅਤੇ ਲਾਈਵ ਰੁਝਾਨ" },
    companies: { label: "ਕੰਪਨੀਆਂ (Companies)", blurb: "ਸੂਚੀਬੱਧ, ਗੈਰ-ਸੂਚੀਬੱਧ ਅਤੇ ਆਉਣ ਵਾਲੇ ਆਈਪੀਓ" },
    research: { label: "ਖੋਜ (Research)", blurb: "ਕੁਆਂਟ ਮਾਡਲ, ਸਕ੍ਰੀਨਰ ਅਤੇ ਟਰੈਕ ਰਿਕਾਰਡ" },
  },
  or: {
    markets: { label: "ବଜାର (Markets)", blurb: "ବଜାରର ବର୍ତ୍ତମାନର ସ୍ଥିତି ଏବଂ ଗତିବିଧି" },
    companies: { label: "କମ୍ପାନୀ (Companies)", blurb: "ତାଲିକାଭୁକ୍ତ, ଅଣତାଲିକାଭୁକ୍ତ ଏବଂ ଆଗାମୀ ଆଇପିଓ" },
    research: { label: "ଗବେଷଣା (Research)", blurb: "ମଡେଲ, ସ୍କ୍ରିନର ଏବଂ ଟ୍ରାକ୍ ରେକର୍ଡ" },
  },
  as: {
    markets: { label: "বজাৰ (Markets)", blurb: "বজাৰৰ বৰ্তমানৰ অৱস্থা আৰু লাইভ গতি" },
    companies: { label: "কোম্পানী (Companies)", blurb: "তালিকাভুক্ত, অতালিকাভুক্ত আৰু আহিবলগীয়া আইপিঅ'" },
    research: { label: "গৱেষণা (Research)", blurb: "মডেল, স্ক্ৰীনাৰ আৰু ট্ৰেক ৰেকৰ্ড" },
  },
  raj: {
    markets: { label: "बाजार (Markets)", blurb: "बाजार रो ताजा हाल अर लाइव रुझान" },
    companies: { label: "कंपनियां (Companies)", blurb: "लिस्टेड, अनलिस्टेड अर आवण आला आईपीओ" },
    research: { label: "अनुसंधान (Research)", blurb: "क्वांट मॉडल, स्क्रीनर्स अर ट्रैक रिकॉर्ड" },
  },
  ks: {
    markets: { label: "बाज़ार (Markets)", blurb: "बाज़ारुक मौजूदा हाल तॖ लाइव सूरत" },
    companies: { label: "कंपनियां (Companies)", blurb: "फ़ेहरिस्त शुदा तॖ अनलिस्टेड कंपनियां" },
    research: { label: "तहक़ीक़ (Research)", blurb: "मॉडल, स्क्रीनर तॖ ट्रैक रिकॉर्ड" },
  },
};

interface LocalizedItemLabels {
  label: string;
  hint: string;
}

const ITEM_OVERRIDES: Partial<Record<SupportedLocale, Record<string, LocalizedItemLabels>>> = {
  hi: {
    "/live": { label: "लाइव मार्केट कॉकपिट", hint: "रियल-टाइम रडार एवं ट्रेडिंग पल्स" },
    "/orderflow": { label: "ऑर्डर फ्लो एवं ब्लॉक सौदे", hint: "फुटप्रिंट, CVD एवं संस्थागत बल्क डील्स" },
    "/results": { label: "तिमाही नतीजे एवं ट्रिगर्स", hint: "स्कोरकार्ड, कॉर्पोरेट कैलेंडर एवं इवेंट्स" },
    "/bhavcopy": { label: "भावकॉपी एवं डिलीवरी", hint: "दैनिक आधिकारिक डिलीवरी एवं संस्थागत संचय" },
    "/sectors": { label: "सेक्टर ऑपरेटिंग KPIs", hint: "ऑटो, बैंक क्रेडिट एवं पावर सेक्टर मैट्रिक्स" },
    "/sme": { label: "एसएमई एक्सचेंज बोर्ड", hint: "NSE इमर्ज एवं BSE एसएमई लाइव बोर्ड" },
    "/briefing": { label: "दैनिक ब्रीफिंग एवं इंटेलिजेंस", hint: "आज का संपूर्ण सार: मॉर्निंग मेमो व ट्रिगर्स" },
    "/news": { label: "एक्सचेंज फाइलिंग्स", hint: "नियामक फाइलिंग्स एवं कॉर्पोरेट घोषणाएं" },
    "/ipo": { label: "आईपीओ एवं प्राइमरी डेस्क", hint: "सक्रिय, आगामी एवं एसएमई निर्गम" },
    "/unlisted": { label: "गैर-सूचीबद्ध कंपनियां", hint: "प्राइवेट इक्विटी एवं अनलिस्टेड शेयर्स" },
    "/watchlist": { label: "वॉचलिस्ट", hint: "आपकी चयनित प्रतिभूतियां एक नज़र में" },
    "/portfolio": { label: "पोर्टफोलियो एवं टैक्स डेस्क", hint: "होल्डिंग्स, XIRR एवं ₹1.25L टैक्स हार्वेस्टर" },
    "/compare": { label: "कंपनियों की तुलना", hint: "मल्टी-स्क्रिप लेजर एवं समकक्ष तुलना" },
    "/analyzer": { label: "इवेंट एनालाइजर", hint: "कॉर्पोरेट इवेंट प्रभाव एवं सेंटिमेंट विश्लेषण" },
    "/alerts": { label: "अलर्ट्स एवं ट्रिगर्स", hint: "मूल्य स्तर एवं नई एक्सचेंज फाइलिंग्स" },
    "/status": { label: "प्लेटफ़ॉर्म पारदर्शिता", hint: "डेटा फीड फ्रेशनेस एवं ऑडिट लॉग" },
    "/risk-lab": { label: "क्वांट रिस्क लैब (STRS)", hint: "क्राइसिस स्ट्रेस टेस्टिंग एवं फैक्टर एट्रिब्यूशन" },
    "/workspace": { label: "टर्मिनल लॉन्चपैड (W)", hint: "4-विंडो टाइल्ड वर्कस्टेशन कलर सिंक सहित" },
    "/api-docs": { label: "एक्सेल एवं पब्लिक एपीआई", hint: "लाइव स्प्रेडशीट फॉर्मूला एवं REST API" },
  },
  bn: {
    "/live": { label: "লাইভ মার্কেট ককপিট", hint: "রিয়েল-টাইম মার্কেট রাডার ও পালস" },
    "/orderflow": { label: "অর্ডার ফ্লো ও ব্লক ডিল", hint: "ফুটপ্রিন্ট, সিভিডি ও প্রাতিষ্ঠানিক ডিল" },
    "/results": { label: "কোয়ার্টারলি ফলাফল", hint: "আর্নিংস স্কোরকার্ড ও ক্যালেন্ডার" },
    "/bhavcopy": { label: "ভাবকপি ও ডেলিভারি", hint: "অফিসিয়াল ডেলিভারি ও জমা বিশ্লেষণ" },
    "/sectors": { label: "সেক্টর অপারেটিং কেপিআই", hint: "অটো, ক্রেডিট ও বিদ্যুৎ ক্ষেত্র" },
    "/sme": { label: "এসএমই এক্সচেঞ্জ বোর্ড", hint: "এনএসই এমার্জ ও বিএসই এসএমই বোর্ড" },
    "/briefing": { label: "মর্নিং ব্রিফিং ও ইন্টেলিজেন্স", hint: "এক নজরে সারাদিনের খবর ও ট্রিগার" },
    "/news": { label: "এক্সচেঞ্জ ফাইলিং", hint: "নিয়ন্ত্রক ফাইলিং ও কর্পোরেট ঘোষণা" },
    "/ipo": { label: "আইপিও ও প্রাইমারি ডেস্ক", hint: "বর্তমান ও আসন্ন আইপিও" },
    "/unlisted": { label: "অতালিকাভুক্ত কোম্পানি", hint: "প্রাইভেট ইকুইটি ও আনলিস্টেড শেয়ার" },
    "/watchlist": { label: "ওয়াচলিস্ট", hint: "আপনার পছন্দের স্টক এক নজরে" },
    "/portfolio": { label: "পোর্টফোলিও ও ট্যাক্স ডেস্ক", hint: "হোল্ডিংস, XIRR ও ট্যাক্স হার্ভেস্টিং" },
    "/compare": { label: "কোম্পানি তুলনা", hint: "মাল্টি-স্ক্রিপ তুলনামূলক খতিয়ান" },
    "/analyzer": { label: "ইভেন্ট অ্যানালাইজার", hint: "ইভেন্টের প্রভাব ও সেন্টিমেন্ট স্কোর" },
    "/alerts": { label: "অ্যালার্টস", hint: "দামের মাত্রা ও নোটিফিকেশন" },
    "/status": { label: "টার্মিনাল স্ট্যাটাস", hint: "ফিড স্ট্যাটাস ও প্ল্যাটফর্ম অডিট" },
    "/risk-lab": { label: "কোয়ান্ট রিস্ক ল্যাব (STRS)", hint: "স্ট্রেস টেস্টিং ও রিস্ক ফ্যাক্টর" },
    "/workspace": { label: "টার্মিনাল ওয়ার্কস্টেশন (W)", hint: "৪-উইন্ডো টাইল্ড ওয়ার্কস্টেশন" },
    "/api-docs": { label: "এক্সেল ও পাবলিক এপিআই", hint: "লাইভ স্প্রেডশিট ও রেস্ট এপিআই" },
  },
  gu: {
    "/live": { label: "લાઇવ માર્કેટ કોકપિટ", hint: "રીયલ-ટાઇમ માર્કેટ રડાર અને પલ્સ" },
    "/orderflow": { label: "ઓર્ડર ફ્લો અને બ્લોક ડીલ્સ", hint: "ફૂટપ્રિન્ટ, સીવીડી અને બ્લોક ડીલ્સ" },
    "/results": { label: "પરિણામો અને કેટાલિસ્ટ્સ", hint: "સ્કોરકાર્ડ, કેલેન્ડર અને ઇમ્પ્લાઇડ મૂવ્સ" },
    "/bhavcopy": { label: "ભાવકોપી અને ડિલિવરી", hint: "ઓફિશિયલ ડિલિવરી અને સંચય" },
    "/sectors": { label: "સેક્ટર ઓપરેટિંગ કેપીઆઇ", hint: "ઓટો, બેંક ક્રેડિટ અને પાવર ડેટા" },
    "/sme": { label: "એસએમઇ એક્સચેન્જ બોર્ડ", hint: "એનએસઇ ઇમર્જ અને બીએસઇ એસએમઇ બોર્ડ" },
    "/briefing": { label: "દૈનિક બ્રીફિંગ અને ઇન્ટેલિજન્સ", hint: "આજનો દિવસ એક નજરમાં" },
    "/news": { label: "એક્સચેન્જ ફાઇલિંગ્સ", hint: "નિયમનકારી ફાઇલિંગ અને પ્રેસ રિલીઝ" },
    "/ipo": { label: "આઈપીઓ અને પ્રાઇમરી ડેસ્ક", hint: "ઓપન, અપકમિંગ અને એસએમઇ ઇશ્યૂ" },
    "/unlisted": { label: "અનલિસ્ટેડ કંપનીઓ", hint: "પ્રાઇવેટ ઇક્વિટી માટે ડીલર ભાવ" },
    "/watchlist": { label: "વોચલિસ્ટ", hint: "તમારી પસંદગીની કંપનીઓ એક નજરમાં" },
    "/portfolio": { label: "પોર્ટફોલિયો અને ટેક્સ ડેસ્ક", hint: "હોલ્ડિંગ્સ, XIRR અને ટેક્સ હાર્વેસ્ટર" },
    "/compare": { label: "કંપનીઓની સરખામણી", hint: "હેડ-ટુ-હેડ મલ્ટી-સ્ક્રિપ લેજર" },
    "/analyzer": { label: "ઇવેન્ટ એનાલાઇઝર", hint: "ઇવેન્ટ અસર અને સેન્ટિમેન્ટ અભ્યાસ" },
    "/alerts": { label: "ચેતવણીઓ (Alerts)", hint: "ભાવ સ્તર અને નવી ફાઇલિંગ્સ" },
    "/status": { label: "પ્લેટફોર્મ પારદર્શિતા", hint: "ડેટા ફીડ તાજગી અને ઓડિટ લોગ" },
    "/risk-lab": { label: "ક્વોન્ટ રિસ્ક લેબ (STRS)", hint: "ક્રાઇસિસ સ્ટ્રેસ ટેસ્ટિંગ" },
    "/workspace": { label: "ટર્મિનલ લોન્ચપેડ (W)", hint: "૪-વિન્ડો ટાઇલ્ડ વર્કસ્ટેશન" },
    "/api-docs": { label: "એક્સેલ અને પબ્લિક એપીઆઈ", hint: "લાઇવ સ્પ્રેડશીટ અને REST API" },
  },
  mr: {
    "/live": { label: "थेट बाजार कॉकपिट", hint: "रिअल-टाइम रडार आणि ट्रेडिंग पल्स" },
    "/orderflow": { label: "ऑर्डर फ्लो आणि सौदे", hint: "फूटप्रिंट, CVD आणि संस्थात्मक ब्लॉक्स" },
    "/results": { label: "तिमाही निकाल आणि ट्रिगर्स", hint: "स्कोअरकार्ड, कॅलेंडर आणि इव्हेंट्स" },
    "/bhavcopy": { label: "भावकॉपी आणि डिलिव्हरी", hint: "अधिकृत डिलिव्हरी आणि संचयन डेटा" },
    "/sectors": { label: "क्षेत्रनिहाय केपीआय", hint: "ऑटो, बँक क्रेडिट आणि पॉवर मेट्रिक्स" },
    "/sme": { label: "एसएमई एक्सचेंज बोर्ड", hint: "NSE इमर्ज आणि BSE एसएमई बोर्ड" },
    "/briefing": { label: "दैनिक माहिती आणि बुद्धिमत्ता", hint: "आजचे मार्केट एका पानात" },
    "/news": { label: "एक्सचेंज फाइलिंग्स", hint: "नियामक फाइलिंग्स आणि घोषणा" },
    "/ipo": { label: "आयपीओ आणि प्राथमिक डेस्क", hint: "सक्रिय आणि आगामी आयपीओ" },
    "/unlisted": { label: "नोंदणी नसलेल्या कंपन्या", hint: "प्रायव्हेट इक्विटी आणि अनलिस्टेड शेअर्स" },
    "/watchlist": { label: "वॉचलिस्ट", hint: "तुमच्या कंपन्या एका दृष्टिक्षेपात" },
    "/portfolio": { label: "पोर्टफोलिओ आणि कर डेस्क", hint: "होल्डिंग्स, XIRR आणि कर बचत" },
    "/compare": { label: "कंपन्यांची तुलना", hint: "तुलनात्मक विश्लेषण लेजर" },
    "/analyzer": { label: "इव्हेंट ॲनालायझर", hint: "घटनेचा प्रभाव आणि विश्लेषण" },
    "/alerts": { label: "अलर्ट्स आणि सूचना", hint: "किंमत पातळी आणि नवीन फाइलिंग्स" },
    "/status": { label: "प्लॅटफॉर्म पारदर्शकता", hint: "डेटा फीड आणि ऑडिट लॉग" },
    "/risk-lab": { label: "क्वांट रिस्क लॅब (STRS)", hint: "क्रायसिस स्ट्रेस टेस्टिंग" },
    "/workspace": { label: "टर्मिनल लाँचपॅડ (W)", hint: "४-विंडो टाइल्ड वर्कस्टेशन" },
    "/api-docs": { label: "एक्सेल आणि पब्लिक एपीआय", hint: "स्प्रेडशीट फॉर्म्युला आणि API" },
  },
  ta: {
    "/live": { label: "நேரடி சந்தை காக்பிட்", hint: "நிகழ்நேர சந்தை ரேடார்" },
    "/orderflow": { label: "ஆர்டர் ஓட்டம் மற்றும் ஒப்பந்தங்கள்", hint: "தடயவியல் மற்றும் மொத்த ஒப்பந்தங்கள்" },
    "/results": { label: "வருவாய் மற்றும் மாற்றங்கள்", hint: "மதிப்பெண் அட்டை மற்றும் காலண்டர்" },
    "/bhavcopy": { label: "பாவ்காப்பி மற்றும் டெலிவரி", hint: "அதிகாரப்பூர்வ விநியோக சேகரிப்பு" },
    "/sectors": { label: "துறை இயக்க குறிகாட்டிகள்", hint: "ஆட்டோ, வங்கி கடன் மற்றும் மின்சாரம்" },
    "/sme": { label: "எஸ்எம்இ பரிவர்த்தனை வாரியம்", hint: "NSE மற்றும் BSE SME வாரியம்" },
    "/briefing": { label: "காலை விளக்கவுரை", hint: "இன்றைய செய்தி மற்றும் தூண்டுதல்கள்" },
    "/news": { label: "பரிவர்த்தனை தாக்கல்கள்", hint: "கார்ப்பரேட் அறிவிப்புகள்" },
    "/ipo": { label: "ஐபிஓ மற்றும் முதன்மை தளம்", hint: "வரவிருக்கும் மற்றும் புதிய வெளியீடுகள்" },
    "/unlisted": { label: "பட்டியலிடப்படாத நிறுவனங்கள்", hint: "தனியார் ஈக்விட்டி பங்குகள்" },
    "/watchlist": { label: "கண்காணிப்பு பட்டியல்", hint: "உங்கள் நிறுவனங்கள் ஒரே பார்வையில்" },
    "/portfolio": { label: "போர்ட்ஃபோலியோ மற்றும் வரி", hint: "பங்குகள் மற்றும் வரி அறுவடை" },
    "/compare": { label: "நிறுவனங்களை ஒப்பிடுக", hint: "நேருக்கு நேர் விரிவான ஒப்பீடு" },
    "/analyzer": { label: "நிகழ்வு ஆய்வாளர்", hint: "நிகழ்வு தாக்கம் மற்றும் உணர்வு" },
    "/alerts": { label: "எச்சரிக்கைகள்", hint: "விலை நிலைகள் மற்றும் அறிவிப்புகள்" },
    "/status": { label: "வெளிப்படைத்தன்மை நிலை", hint: "தரவு புத்துணர்ச்சி மற்றும் தணிக்கை" },
    "/risk-lab": { label: "அளவீட்டு இடர் ஆய்வகம்", hint: "நெருக்கடி அழுத்த சோதனை" },
    "/workspace": { label: "டெர்மினல் பணியிடம் (W)", hint: "4-சாளர ஒருங்கிணைந்த பணிமேடை" },
    "/api-docs": { label: "எக்செல் மற்றும் பொது ஏபிஐ", hint: "நேரடி விரிதாள் மற்றும் REST API" },
  },
};

export function getLocalizedNavGroups(locale: SupportedLocale, dict: Dictionary): NavGroup[] {
  const meta = GROUP_TITLES[locale] || GROUP_TITLES.en;
  const overrides = ITEM_OVERRIDES[locale] || {};

  const resolveItem = (
    href: string,
    defaultLabel: string,
    defaultHint: string,
    icon: LucideIcon,
    dictLabel?: string
  ): NavItem => {
    const ov = overrides[href];
    const label = dictLabel || ov?.label || defaultLabel;
    const hint = ov?.hint || defaultHint;
    return { href, label, hint, icon };
  };

  return [
    {
      key: "markets",
      label: meta.markets.label,
      blurb: meta.markets.blurb,
      items: [
        resolveItem("/live", "Live market cockpit", "God's-eye live trading radar & pulse", Radio),
        resolveItem("/market-watch", "Market watch", "Indices, movers, breadth and sector RRG", CandlestickChart, dict.nav.marketWatch),
        resolveItem("/derivatives", "Derivatives & F&O", "Option chains, open interest, build-up & ban", Sigma, dict.nav.derivatives),
        resolveItem("/orderflow", "Order flow & deals", "Footprint, CVD, GEX and institutional block deals", Activity),
        resolveItem("/results", "Earnings & catalysts", "Scorecard, calendar, implied moves & rebalances", FileBarChart),
        resolveItem("/bhavcopy", "Bhavcopy & Delivery", "End-of-day delivery and accumulation", Layers),
        resolveItem("/commodities", "Commodities", "Metals, energy and the rupee", Coins, dict.nav.commodities),
        resolveItem("/surveillance", "Surveillance & bands", "SEBI ASM, GSM & Price Bands", ShieldAlert, dict.nav.surveillance),
        resolveItem("/yield-curve", "Sovereign yield curve", "G-Sec par curve, T-Bills & RBI corridor", LineChart, dict.nav.yieldCurve),
        resolveItem("/sectors", "Sector Operating KPIs", "SIAM auto, RBI credit, CEA power & DGCA", Activity),
        resolveItem("/sme", "SME Exchange Board", "NSE Emerge & BSE SME active board", Rocket),
      ],
    },
    {
      key: "companies",
      label: meta.companies.label,
      blurb: meta.companies.blurb,
      items: [
        resolveItem("/briefing", "Briefing & Intelligence", "Today in one page: morning memo, news & triggers", Sunrise),
        resolveItem("/news", "Exchange filings", "Corporate announcements & press releases", Newspaper),
        resolveItem("/ipo", "IPO & Primary desk", "Open, upcoming, SME & listed issues", Rocket),
        resolveItem("/unlisted", "Unlisted companies", "Dealer prices for private equity", Building2),
        resolveItem("/watchlist", "Watchlist", "Your companies at a glance", Star),
        resolveItem("/portfolio", "Portfolio & tax desk", "Holdings, XIRR and ₹1.25L tax harvester", Briefcase),
        resolveItem("/network", "Corporate network & SPLC", "Multi-tier supply chain, customer off-take & group holdings", Network, dict.nav.corporateNetwork),
      ],
    },
    {
      key: "research",
      label: meta.research.label,
      blurb: meta.research.blurb,
      items: [
        resolveItem("/screener", "Stock screener", "Factor, momentum, MACD & fundamental screens", ScanSearch, dict.nav.screener),
        resolveItem("/compare", "Compare companies", "Head-to-head multi-scrip ledger", ArrowLeftRight),
        resolveItem("/analyzer", "Event analyzer", "What one event did to a stock", FlaskConical),
        resolveItem("/alerts", "Alerts", "Price levels and new filings", Bell),
        resolveItem("/status", "Platform transparency", "Feed freshness, mathematical methodology & audit", Gauge),
        resolveItem("/help", "Terminal Academy", "Command syntax, directory & trading tutorials", BookOpen, dict.nav.academy),
        resolveItem("/risk-lab", "Quant Risk Lab (STRS)", "Crisis stress testing & factor attribution", ShieldAlert),
        resolveItem("/workspace", "Terminal Launchpad (W)", "4-window tiled workstation with color sync", Layers),
        resolveItem("/api-docs", "Excel & Public API", "Live spreadsheet formula & REST API", Sparkles),
      ],
    },
  ];
}
