// מנוע הברכות — the hand-reviewed decisions of the audit (2026-09-30). Every open-data record was listed with the rule
// the automatic steps gave it and read by eye; where the identity or the rule was wrong, the decision is written here.
// Targets: 'r:<rule>' (a rule of rules.mjs), 'row:<name>' (a row of the עונג שבת table, exactly as printed),
// 'pending' (no adequate source for this food: shown as "טרם אומת"), 'exclude:<reason>' (not listed at all).

// ------------------------------------------------------------------------------------------- Wikidata
// Keyed by "<Hebrew label>=<English label>" — a Hebrew label alone is not an identity (two items are called "טילון",
// and "בננה בלי מלח" is a vandalised label of Jachnun).
const X = reason => `exclude:${reason}`;
export const WD_TARGET = {
  // not a food, not eaten on its own, a process, a category, a rite, or not kosher
  'חלב אם=breast milk': X('not a food'), 'חלב חזירים=pig milk': X('not kosher'), 'חלב ארנבים=rabbit milk': X('not kosher'),
  'חלב סוסות=mare milk': X('not kosher'), 'חלב אתון=donkey milk': X('not kosher'), 'חלב נאקות=camel milk': X('not kosher'), 'קומיס=kumis': X('not kosher'),
  'קולוסטרום=colostrum': X('not a food'), 'אבקת חלב=milk powder': X('not eaten on its own'), 'חמאה מזוקקת=clarified butter': X('not eaten on its own'),
  'גהי=ghee': X('not eaten on its own'), 'סאמנה=smen': X('not eaten on its own'), 'מי גבינה=whey': X('not eaten on its own'),
  'מערכת סיווג היינות הגרמנית=German wine classification': X('not a food'), 'יינות העולם החדש=New World wine': X('not a food'),
  'קטלוניה=Denominación de Origen Catalunya': X('not a food'), 'יין בארץ ישראל=Israeli wine': X('not a food'),
  'הנבטה=sprouting': X('not a food'), 'החמצת מזון=pickle': X('not a food'), 'פרי הנחשב ירק=fruit vegetable': X('not a food'),
  'פרי עץ הדעת=forbidden fruit': X('not a food'), 'שקית מתנות=goodie bag': X('not a food'), 'מילו (מותג מזון)=Milo': X('not eaten on its own'),
  'אבקת מרק=bouillon cube': X('not eaten on its own'), 'לחם הקודש=sacramental bread': X('not a food'), 'אפיקומן=Afikoman': X('not a food'),
  'אכילת מצה=?': X('not a food'), 'פירורי לחם=bread crumbs': X('not eaten on its own'), 'זנגוויל=ginger': X('not eaten on its own'),
  'גלנגל=galangal': X('not eaten on its own'), "צ'נפי=chenpi": X('not eaten on its own'), 'גארי (מאכל)=gari': X('not eaten on its own'),
  'רליש בסגנון שיקגו=Chicago-style relish': X('not eaten on its own'), 'סירופ שוקולד=chocolate syrup': X('not eaten on its own'),
  'Fucking Hell=Fucking Hell': X('name not fit to display'), 'סטרפסילס=Strepsils': X('medicine'), 'אגוז אריקה=areca nut': X('not a food'),
  'אגוז הקולה=kola nut': X('not a food'), 'בושינטנג=bosintang': X('not kosher'), 'מרק צבים=turtle soup': X('not kosher'),
  'ביסק=bisque': X('not kosher'), 'בויאבז=bouillabaisse': X('not kosher'), 'סיאמבן=jambon': X('not kosher'), 'קאסו מארצו=casu martzu': X('not kosher'),
  'סם חיי הנצח=elixir of life': X('not a food'), 'גוגואים=apricot kernel': X('not a food'), 'בננה בלי מלח=Jachnun': X('label is not the name of the food (ג׳חנון is a row of the table)'),
  'עוגיות, ביסקוויטים, קרקרים=cookies, biscuits, crackers': X('not a food (a customs category)'),
  'מוצרי חלב מותסס, למעט שמנת חמוצה וגבינת קוטג׳=fermented milk products, other than sour cream and cottage cheese': X('not a food (a customs category)'),
  'יוגורט וסוגים אחרים של חלב או שמנת, מותססים או חמוצים=yoghurt and other types of milk or cream, fermented or soured': X('not a food (a customs category)'),
  'ממתקי סוכר (כולל שוקולד לבן), ללא קקאו=Sugar confectionery (including white chocolate), not containing cocoa': X('not a food (a customs category)'),
  'מוצרי מקרוני דמויי־חוט=string-like macaroni products': X('not a food (a customs category)'),
  'קינוח הנאכל בכפית או במזלג קטן=dessert with spoon': X('not a food (a category)'), 'מוצרי מאפה=bakelse': X('not a food (a category)'),
  // nuts and fruit: their own rows or rules (Wikidata put them under "fruit", which sent walnuts to "maybe האדמה")
  'אגוזי מלך=walnut': 'r:tree-nut', 'אגוז פקאן=pecan nut': 'r:tree-nut', 'שקד=almond': 'r:tree-nut', 'צנובר=pine nut': 'r:tree-nut',
  'אגוז פיסטוק=pistachio nut': 'r:tree-nut', 'אגוז לוז=hazelnut': 'r:tree-nut', 'אגוז עץ=tree nut': 'r:tree-nut', 'שקדים מסוכרים=candied almonds': 'r:coated-nut',
  'בוטן=peanut': 'row:בוטנים', 'בוטנים אמריקאיים=Japanese style peanuts': 'row:בוטן אמריקאי',
  'ענב=grape': 'row:ענבים', 'מוסקט לבן=Muscat Blanc à Petits Grains': 'row:ענבים', 'ריזלינג=Riesling': 'row:ענבים', 'קריניאן=Carignan': 'row:ענבים',
  'זית=olive': 'row:זיתים', 'זיתים שחורים=black olive': 'row:זיתים', 'זית קלמטה=Kalamata': 'row:זיתים', 'זית מנזנילה=Manzanilla': 'row:זיתים', 'זית פישולין=Picholine': 'row:זיתים',
  "מג'הול=Medjool": 'row:תמרים', 'דקל נור=Deglet Noor': 'row:תמרים', 'צימוק=raisin': 'row:צימוקים', 'סולטנה=sultana': 'row:צימוקים',
  'מִשְׁמֵשׁ=apricot': 'row:מישמש', 'לדר=fruit leather': 'row:מישמש מרוסק [לדר]', 'קיווי ננסי=hardy kiwi': 'row:קיווי [פרי]', 'לאטונדאן=latundan banana': 'row:בננה',
  'איווריה=Iveria (apple)': 'row:תפוח', 'אנטונובקה (פרי)=Antonovka': 'row:תפוח', 'אמברוזיה (תפוח)=Ambrosia': 'row:תפוח', 'האני-קריספ=Honeycrisp': 'row:תפוח',
  'גרגאנו=Arancia del Gargano PGI': 'row:תפוז', 'חמוציות אדומות=lingonberry': 'r:fruit-plant', 'שזיף שחור=Malabar plum': 'r:tree-fruit', 'נקטרינה=nectarine': 'r:tree-fruit',
  'פומלית=oroblanco': 'r:tree-fruit', 'דוריאן=durian': 'r:tree-fruit', 'פירות אסאי=açai berry': 'r:tree-fruit',
  'משמש מיובש=dried apricot': 'r:dried-fruit', 'שזיף מיובש=prune': 'r:dried-fruit', 'דובדבן מיובש=dried cherry': 'r:dried-fruit',
  'ליים=lime': 'pending', 'ליים קווט=limequat': 'pending', 'תפוזי סביליה=Seville orange': 'pending', 'פלאטנו=cooking banana': 'pending', 'קוקוס טחון=grated coconut': 'pending',
  "טק'לאפי=tklapi": 'pending', 'קורובה=banana passionfruit': 'pending', 'אביונה=caper berry': 'pending', 'פיטאיה=pitahaya': 'pending', 'בלוט=acorn': 'pending',
  'עגבנייה=tomato': 'row:עגבניות', 'עגבניית תמר=Roma tomato': 'row:עגבניות', 'עגבניית סטייק=beefsteak tomato': 'row:עגבניות', 'אבטיח מרובע=square watermelon': 'row:אבטיח',
  'מלון סנטה קלאוס=Santa Claus melon': 'row:מילון', 'מלון גליה=Galia': 'row:מילון', 'ערמון=marron': 'row:ערמונים', 'ערמון=chestnut': 'row:ערמונים',
  'רסק תפוחים=apple sauce': 'row:פירות עץ מרוסקים', 'מחית תפוחי אדמה=mashed potato': 'row:פירה [תפו"א מרוסק]', 'קאשה=buckwheat porridge': 'pending',
  'פירות מסוכרים=candied fruit': 'pending', 'פרי מסוכר=succade': 'pending', 'תפוח מסוכר=Candy apple': 'pending', 'תפוח קרמל=caramel apple': 'pending',
  'לימון כבוש=preserved lemon': 'pending', 'פרי כבוש=pickled fruit': 'pending', 'אומבושי=umeboshi': 'pending', 'לפתן=compote': 'pending',
  // vegetables that are not plain vegetables
  'אצת קומבו=kombu': 'pending', 'שום שחור=black garlic': 'pending', 'עלי גפן=grape leaves': 'pending', 'סיר טורשי=Seer Torshi': 'pending',
  "ג'ינג'ר כבוש=beni shōga": 'pending', 'שורש קסאווה=cassava root': 'pending',
  // sweets: wafer bars, grain in sweets, spreads, honey, gum
  'טורטית=Tortit': 'r:coated-wafer', 'כִּיף כֵּף=Kif Kef': 'r:coated-wafer', 'פסק זמן=Pesek Zman': 'r:coated-wafer', 'קיטקט=Kit Kat': 'r:coated-wafer',
  'קינדר בואנו=Kinder Bueno': 'r:coated-wafer', 'דופלו=Duplo': 'r:coated-wafer',
  'טוויקס=Twix': 'r:grain-sweet', 'מלטיזרס=Maltesers': 'r:grain-sweet', 'רפאלו=Raffaello': 'r:grain-sweet', 'פררו רושה=Ferrero Rocher': 'r:grain-sweet',
  'אבני דומינו=Dominostein': 'r:grain-sweet', 'חטיף מרס מטוגן בשמן עמוק=deep-fried Mars bar': 'pending', 'שוקולד דובאי=Dubai chocolate': 'pending', 'קליק=Klik': 'pending',
  'טוויסט=Twist': 'pending', 'בובי=Bobby': 'pending', 'לשונות חתולים=cat tongues': 'pending',
  'ממרח שוקולד=chocolate spread': 'r:sweet-spread', 'נוטלה=Nutella': 'r:sweet-spread', 'ממרח אגוזי לוז=hazelnut spread': 'r:sweet-spread',
  'ממרח שקדים=Pasta di mandorle PAT': X('label does not match the food (almond paste, not a spread)'),
  'דבש=honey': 'row:דבש דבורים', 'דבש מאנוקה=Mānuka honey': 'row:דבש דבורים', 'רחת לוקום=Turkish delight': 'row:חלקום',
  'מסטיק=chewing gum': 'r:gum', 'אורביט=Orbit': 'r:gum', 'טרידנט=Trident': 'r:gum', 'מסטיק עלמה=?': 'r:gum', 'מסטיק בזוקה=Bazooka': 'r:gum', 'הובה בובה=Hubba Bubba': 'r:gum',
  'לחם זנגביל=gingerbread': 'r:kisnin', 'אלפחור=alfajor': 'r:kisnin', 'קליצ\'ה=Kleicha': 'r:kisnin', "מאנג'ו=manjū": 'pending', 'מונאקה=monaka': 'pending',
  "גולאב ג'אמון=gulab jamun": 'pending', 'גוזינאקי=gozinaki': 'pending', "צ'ורצ'חלה=Churchkhela": 'pending', 'סוהאן=sohan': 'pending', 'פישמניה=pişmaniye': 'pending',
  'שבירונים=brittle': 'pending', 'בונדי (מאכל)=Boondi': 'pending', 'קיר=kheer': 'pending', 'ווגאשי=wagashi': 'pending', 'סביים=seviyan': 'r:grain-cooked',
  'שזיף מצופה שוקולד=Chocolate-covered prune': 'pending', 'פירות מצופי שוקולד=chocolate covered fruit': 'pending', 'חטיף שוקולד=chocolate bar': 'r:chocolate',
  'ליקר שוקולד=chocolate liquor': 'r:spirits',
  // cakes and cookies that are not flour cakes
  'עוגת אורז=rice cake': 'pending', 'עוגת אורז דביק=glutinous rice cake': 'pending', 'מקרון=macaron': 'pending', 'מקרון=macaroon': 'row:עוגיות קוקוס',
  'עוגת שוקולד ללא קמח=flourless chocolate cake': 'pending', 'עוגת גלידה=ice cream cake': 'pending', 'אוזן המן=hamantash': 'row:אזני המן',
  'עוגת גבינה=cheesecake': 'r:grain-sweet', 'כדור רום=rum ball': 'row:כדור שוקולד שמעורב בו ביסקוויט שבור', 'עוגייה=cookie': 'r:kisnin', 'עוגיות חג המולד=Christmas cookies': 'r:kisnin',
  'קרואסון=croissant': 'r:kisnin', 'רוגלך=rugelach': 'r:kisnin', 'ופל=waffle': 'r:kisnin', 'ופל בלגי=Belgian waffle': 'r:kisnin', 'ופלה=wafer cookie': 'r:wafer', 'ופל=wafer': 'row:וופל',
  'שטרופוואפל=stroopwafel': 'r:wafer', 'גרהאם קרקר=graham cracker': 'r:dry-crackers', 'לחם פריך=crispbread': 'r:dry-crackers', 'פקסימתיה=Paximathia': 'r:dry-crackers',
  'ביסקוויט קשה=hardtack': 'r:dry-crackers', 'בקלווה=baklava': 'row:בקלאווה',
  // breads that are not bread
  'סירניקי=Syrniki': 'pending', "פלאצ'ינקן=palatschinke": 'r:grain-cooked', "פלצ'ינטה גונדל=Gundel pancake": 'r:grain-cooked', "פלאצ'ינטה נוסח הורטובאג=Hortobágyi palacsinta": 'r:filled-dough',
  'חביתית=pancake': 'r:grain-cooked', 'קייזרשמרן=Kaiserschmarrn': 'r:grain-cooked', 'באגריר=Baghrir': 'r:grain-cooked', 'לחוח=Lahoh': 'r:grain-cooked', 'גאלט=galette': 'pending',
  'פורי (מאכל)=puri': 'r:grain-cooked', 'בהטורה=bhatoora': 'r:grain-cooked', 'לנגוש=lángos': 'r:grain-cooked', 'סאל רוטי=Sel roti': 'r:grain-cooked', 'בורטסוג=baursak': 'r:grain-cooked',
  'מקיצה=Mekitsa': 'r:grain-cooked', 'פלטקאקה=Flatkaka': 'pending', 'אוקונומיאקי=okonomiyaki': 'pending', 'בננה לוטי=Mutabak': 'r:filled-dough', 'לחם קארי=curry bread': 'r:filled-dough',
  'מאפין=muffin': 'r:kisnin', 'פיתפית=fit-fit': 'pending', 'סקונס=scone': 'r:kisnin', 'מצות=unleavened bread': 'row:מצה [לא בפסח]', 'לחם מונבט=sprouted bread': 'pending',
  'לחמניית סאלי לן=Sally Lunn bun': 'r:sweet-bread', 'שירמל=Sheermal': 'r:sweet-bread', 'טורטייה מקמח=wheat tortilla': 'r:tortilla', 'קוקייה=?': 'pending',
  "בייגל ירושלמי=ka'ak al-Quds": 'row:בייגל גדול רך כלחם', 'לחם תירס=cornbread': 'pending', 'לחם תירס=maize bread': 'pending', 'לחם אורז=rice bread': 'pending',
  "אנג'רה=injera": 'pending', 'פאינה=farinata': 'pending', 'סובה=soba': 'pending',
  // pasta and dumplings
  'אטריות אורז=rice noodle': 'r:rice', 'דים סאם=dim sum': 'r:filled-dough', 'ספרינג רול=spring roll': 'r:filled-dough', 'אמפנדה=empanada': 'r:filled-dough',
  "צ'יבורקי=chebureki": 'r:filled-dough', 'קרפלך=kreplach': 'r:filled-dough', 'טורטליני=tortellini': 'r:filled-dough', 'מאולטשה=Maultasche': 'r:filled-dough',
  'פסטה ממולאת=stuffed pasta': 'r:filled-dough', 'חושור=Khuushuur': 'r:filled-dough', "גוג'ייה=gujia": 'r:filled-dough', 'רביולי=ravioli': 'r:filled-dough',
  'פלמני=pelmeni': 'r:filled-dough', 'גיוזה=gyoza': 'r:filled-dough', 'באוזי=baozi': 'r:filled-dough', 'וון-טון=wonton': 'r:filled-dough', "ג'יוז'י=jiaozi": 'r:filled-dough',
  'שיאולונגבאו=xiaolongbao': 'r:filled-dough', 'מומו=momo': 'r:filled-dough', 'מנטו=manti': 'r:filled-dough', 'ורניקס=varenyky': 'r:filled-dough', 'פירושקי=pierogi': 'r:filled-dough',
  'חינקלי=Khinkali': 'r:filled-dough', 'קלדוני=Kalduny': 'r:filled-dough', 'פיזי=pyzy': 'pending', 'קיפולית=turnover': 'r:filled-dough', 'שוסון או פום=chausson aux pommes': 'r:filled-dough',
  'פשיטדת בשר=meat pie': 'r:filled-dough', 'סמוסה=samosa': 'r:filled-dough', 'ספנקופיטה=spanakopita': 'r:filled-dough', 'טירופיטה=tiropita': 'r:filled-dough',
  'באניצה=banitsa': 'r:filled-dough', 'בורקס=börek': 'row:בורקס [בצק עלים]', 'בוגטסה=bougatsa': 'r:filled-dough', 'פסטיץ=pastizz': 'r:filled-dough',
  'פטאייר=fatayer': 'r:filled-dough', 'ספיחה=sfiha': 'r:filled-dough', 'קוטאב=qutab': 'r:filled-dough', 'מאפה קרלי=Karelian pasty': 'pending', 'קניש=knish': 'r:filled-dough',
  'קלצונה=calzone': 'r:filled-dough', 'פירוגי רוסי=pirog': 'r:filled-dough', 'בדפורדשייר קלנגר=Bedfordshire clanger': 'r:filled-dough', 'משה בתיבה=sausage roll': 'r:filled-dough',
  'לחם נקניקייה=sausage bread': 'r:filled-dough', 'נקניקייה בלחמנייה=hot dog': 'r:sandwich', 'ניוקי=gnocchi': 'r:grain-cooked',
  'קניידלעך=matzah ball': 'row:קניידלך', 'קוגל ירושלמי=Kugel Yerushalmi': 'row:קוגל [אטריות]',
  // pastries, doughnuts, sweet breads
  'שוקולטין=pain au chocolat': 'r:kisnin', 'דניש=Danish': 'r:kisnin', 'מאפים מתוקים=sweet pastry': 'r:kisnin', 'מאפים וינאיים=viennoiserie': 'r:kisnin', 'שבלול קינמון=cinnamon roll': 'r:kisnin',
  'שבלול צימוקים=pain aux raisins': 'r:kisnin', 'קראפין=cruffin': 'r:kisnin', 'קרונאט=Cronut': 'r:kisnin', 'קוין-אמאן=kouign-amann': 'r:kisnin', 'פרנצברטשן=Franzbrötchen': 'r:kisnin',
  'אוזני פיל=palmier': 'r:kisnin', 'באבקה=babka': 'r:kisnin', "קוליץ'=kulich": 'r:sweet-bread', 'פאנדורו=Pandoro': 'r:kisnin', 'פנטונה=panettone': 'r:kisnin',
  'קולומבה=Colomba di Pasqua': 'r:kisnin', 'שטולן=stollen': 'r:kisnin', 'בריוש=brioche': 'r:sweet-bread', 'לחם מתוק=sweet bread': 'r:sweet-bread', 'לחמניה מתוקה=sweet roll': 'r:sweet-bread',
  'לחמניות פסחא=hot cross bun': 'r:sweet-bread', 'לחמניית זעפרן=St. Lucia bun': 'r:sweet-bread', "לחמניית צ'לסי=Chelsea bun": 'r:sweet-bread', "לחמניית באת'=Bath bun": 'r:sweet-bread',
  'דונאט=doughnut': 'row:סופגניות', 'ברלינר=Berliner': 'row:סופגניות', 'סופגנייה=sufganiyah': 'row:סופגניות', 'אוליבול=oliebol': 'r:grain-cooked', 'בומבולוני=bombolone': 'row:סופגניות',
  'בנייה=beignet': 'r:grain-cooked', "ספינג'=Sfenj": 'r:grain-cooked', 'זפולה=Zeppole': 'r:grain-cooked', 'במבלוני=Bambalouni': 'r:grain-cooked', "צ'ורוס=churro": 'r:grain-cooked',
  'בצק מטוגן=fried dough': 'r:grain-cooked', 'פריטולה=Frittelle': 'r:grain-cooked', 'טולומבה=tulumba': 'r:grain-cooked', 'פריטר=fritter': 'pending', 'פיקארון=picarón': 'pending',
  'סמולטרינג=smultring': 'r:grain-cooked', 'פרנץ\' טוסט=French toast': 'pending', 'טורטייה=tortilla': 'r:tortilla', 'טורטיית תירס=corn tortilla': 'r:corn-tortilla',
  // ice cream
  'טילון=Cornetto': 'r:ice-cream-cone', 'טילון=Drumstick': 'r:ice-cream-cone', 'גביע גלידה=ice cream cone': 'r:ice-cream-cone', '99 פלייק=99 Flake': 'r:ice-cream-cone',
  'קסטה=ice cream sandwich': 'row:גלידה עם ביסקוויט [קסטה]', 'קינוח מבוסס גלידה=ice cream-based dessert': 'r:ice-cream', 'גלידה פרסית=Faloodeh': 'r:ice-cream',
  'גלידת סנדיי=sundae': 'r:ice-cream', 'פרוזן יוגורט=frozen yogurt': 'r:ice-cream', 'סורבה=sorbet': 'r:ice-cream', 'סמיפרדו=Semifreddo': 'r:ice-cream', 'גרניטה=Granita PAT': 'r:ice-cream',
  'קינוח קפוא=frozen dessert': 'r:ice-cream', 'גליל ארקטי=Arctic roll': 'r:ice-cream-grain', 'אלסקה אפויה=Baked Alaska': 'r:ice-cream-grain', 'גלידת מוצ\'י=mochi ice cream': 'pending',
  'בינג סו=bingsu': 'pending', 'אקוטאק=Alaskan ice cream': 'pending', "קראנץ' פיסטוק=?": 'pending',
  // puddings and creams (milk, eggs, sugar, starch): dairy; with bread, cake or rice: not verified
  'פודינג=pudding': 'r:dairy', 'פודינג רפרפת=custard pudding': 'r:dairy', 'קינוח רפרפת=custard dessert': 'r:dairy', 'חביצה=custard': 'r:dairy', 'קרם ברולה=crème brûlée': 'r:dairy',
  'קרם קרמל=crème caramel': 'r:dairy', 'קרמה קטלנה=crema catalana': 'r:dairy', 'מוס שוקולד=chocolate mousse': 'r:dairy', 'מוס שוקולד=chocolate dessert': 'r:dairy',
  'קרם בוואריה=Bavarian cream': 'r:dairy', 'פודינג פיסטוקים=pistachio pudding': 'r:dairy', 'זביונה=zabaione': 'r:dairy', 'פודינג אורז=rice pudding': 'r:rice',
  // jams and jellies
  'ריבת חמוציות אדומות=lingonberry jam': 'r:jam', 'ריבת פטל אדום=raspberry jam': 'r:jam', 'ריבת בצל=onion jam': X('not eaten on its own'), 'ריבת חלב=dulce de leche': 'r:jam',
  'ריבת ירקות=vegetable jam': 'r:jam', 'ריבת קוקוס=coconut jam': 'r:jam', 'פובידל=powidl': 'r:jam', 'סלאטקו=slatko': 'r:jam', 'חמאת שזיפים=plum butter': 'r:jam',
  'חמאת פירות=fruit butter': 'r:jam', 'קריש לימון=fruit curd': 'r:jam', "ג'לי=gelatin dessert": "row:ג'לי אפילו עם מעט פירות", "ג'לי=aspic": 'r:animal',
  // drinks
  'מיץ ענבים=grape juice': 'r:wine', 'תירוש (משקה)=must': 'r:wine', 'תה קר=iced tea': 'r:drink', 'אייס קפה=iced coffee': 'r:drink', 'פרפוצ\'ינו=Frappuccino': 'r:drink',
  'קפה פרפה=frappé coffee': 'r:drink', 'אספרסו מרטיני=Espresso martini': 'r:spirits', 'רוסי שחור=Black Russian': 'r:spirits', 'תה בועות=bubble tea': 'pending',
  'יין רימונים=pomegranate wine': 'r:fruit-wine', 'יין פרחים=flower wine': 'r:fruit-wine', 'יין פירות=fruit wine': 'r:fruit-wine', 'דוהאט=Duhat wine': 'r:fruit-wine',
  'תמד=mead': 'r:fruit-wine', 'מדובוחה=medovukha': 'r:fruit-wine', 'סיידר תפוחים=apple cider': 'r:fruit-wine',
  'מרטיני=Martini': 'pending', 'ורמוט=vermouth': 'pending', 'ורמוט אדום=red vermouth': 'pending', 'ורמוט יבש=dry vermouth': 'pending', 'ורמוט אדום מתוק=sweet red vermouth': 'pending',
  'לילט=Lillet': 'pending',
  // cereals
  'פולנטה=?': 'r:corn', 'בוזה (גלידה מסטיק סורית)=booza': 'r:ice-cream',
  // merged into the wrong row, or not one food
  'קוקוס=coconut': 'row:אגוז קוקוס', 'לחם מטוגן=fried bread': X('the table has two rows by the size of the pieces'), 'צא=ṣa': X('name unclear'),
  "ג'לי=aspic": X('the Hebrew name is that of the sweet jelly (a row of the table)'),
  // breads, pastries and sweets decided one by one
  'בזין=bazeen': 'pending', 'פתות=Fatoot': 'pending', "יאקימוצ'י=yakimochi": 'pending', 'כריך מונטה כריסטו=Monte Cristo sandwich': 'pending',
  'פיצה מתוקה מברידה=Pizza dolce di Beridde': 'pending', 'כדור שוקולד=choklate ball': 'row:כדור שוקולד שמעורב בו ביסקוויט שבור', 'מקופלת=Mekupelet': 'r:chocolate',
  'לחם בננה=banana bread': 'r:kisnin', 'פאי תפוחים=apple pie': 'r:kisnin', 'פאי פקאן=pecan pie': 'r:kisnin', 'פאי מתוק=sweet pie': 'r:kisnin', 'טארט=tart': 'r:kisnin',
  "מעמול=Ma'amoul": 'r:kisnin', 'בייגלי=poppy seed roll': 'r:kisnin', 'פטיפור=petit four': 'r:kisnin', 'רבאני=Revani': 'r:kisnin', 'שקרפרה=şekerpare': 'r:kisnin',
  'פסטפרולה=pastafrola': 'r:kisnin', 'טייגלעך=Teiglach': 'r:kisnin', 'לחם אמיש=Amish Friendship Bread': 'r:kisnin', 'כנאפה=knafeh': 'r:filled-dough', 'קיש=quiche': 'r:filled-dough',
  'קטאיף=qatayef': 'r:filled-dough', 'בריק (מזון)=Brik': 'r:filled-dough',
  // one name, two foods, or the same food as a row of the table
  'פולאר=Folar': X('same Hebrew name as another food (Polar beer)'), 'ופל=waffle': X('same Hebrew name as the wafer; the waffle is "ופל בלגי"'), 'קולאק=Colaci': X('same Hebrew name as another food'),
  "סוכריות ג'לי=jelly bean": 'row:סוכריות', 'שוקולד חלב=milk chocolate': 'row:שוקולד', 'שוקולד מריר=dark chocolate': 'row:שוקולד', 'שוקולד לבן=white chocolate': 'row:שוקולד',
  'שמנת חמוצה=sour cream': 'row:שמנת', "קונצ'ה=concha": 'r:sweet-bread',
};
// Wikidata labels that name two different foods: the name shown says which (the label stays searchable).
export const WD_NAME = {
  "קראנץ'=Nestlé Crunch": "קראנץ' (שוקולד נסטלה)", 'קראנץ=Krantz cake': "עוגת קראנץ'", 'מקרון=macaron': 'מקרון (עוגיית שקדים צרפתית)', 'מקרון=macaroon': 'מקרון קוקוס',
  'קרופניק=krupnik': 'קרופניק (מרק גריסים)', 'קרופניק=Krupnik': 'קרופניק (ליקר דבש)', "קונצ'ה=konacha": "קונצ'ה (תה)", "קונצ'ה=concha": "קונצ'ה (לחמנייה מתוקה)",
  'פרלין=Belgian praline': 'פרלין בלגי', 'קוקוס=coconut': 'קוקוס (אגוז הקוקוס)',
};
// Other names that are not names of the food ("אכילת מצה" is the mitzvah, not a food).
export const BAD_ALIASES = ['אכילת מצה'];

// ------------------------------------------------------------------------------------------- Open Food Facts
// Names as their contributors typed them, proofread (the typed name stays searchable as another name, never shown as
// the name). Keyed by barcode.
export const NAME_FIXES = {
  '7290016492033': "גרנולה קראנץ' שוקולד", '7296150000011': 'עלי גפן ממולאים באורז', '7290001901656': 'קציצות דגים בסגנון גפילטע פיש',
  '7290019545873': 'שוקולד מריר', '7290104724718': 'שוקולד קרם נוגט', '7290014749726': 'שניצל קריספי', '7290008753111': "תפוצ'יפס קראנץ' מקסיקני",
  '7290112493927': 'גלידה בטעם ריבת חלב', '7290018581018': 'לחם קל שיפון', '7290018500644': 'פיתה כוסמין לבן', '7290001892107': 'לחם שיפון פרוס להכנת טוסט',
  '7290004033729': 'לחם פרוסות עבות קמח כוסמין', '7290011142650': 'לחם שיפון 100% מחמצת טבעית', '7290018296127': 'פיתה כוסמין מלא מועשרת בחלבון',
  '7290000552989': 'בשר עגל טחון קפוא רמת שומן בינונית', '7290001455791': 'פילה זהבון ללא עור מכיל לפחות 80% דג', '7290019205111': 'פסטרמה מעושנת',
  '7290017617138': 'נתחי טונה בהירה במים', '7290117267394': 'טונה בשמן זית', '7290016106664': 'טונה במי מלח', '7290002371526': "פסטרמה שום וצ'ילי פיקנטי",
  '7290013186072': 'פסטרמה שינקן פולני', '7290000364261': 'פסטרמה דק דק כתף בקר', '7290019205258': 'פסטרמה עוף דק דק ברביקיו', '7290017617701': "פילה טונה סטאר קיסט פלפל צ'ילי",
  '7290105369130': 'גבינה במרקם שמנת', '7296073731849': 'גבינת גאודה', '7290110325312': 'תנובה גו גביע חלבון', '7290000408316': 'יוגורט ביו שטראוס 3 אחוז',
  '7290000169538': 'מרק עגבניות עם קרוטונים', '7290012453519': 'מלפפונים בחומץ', '7290002111764': 'שעועית לבנה ברוטב עגבניות', '7290000068282': 'מנה חמה',
  '7290115202847': 'מנה חמה נודלס ספייסי', '7290118427643': 'מנה חמה Wok', '7290019056348': 'לימונענע', '7290114312950': 'משקה בטעם וניל עם חלבוני חלב 0% שומן',
  '7296073112464': 'פסטה מלאה שופרסל', '7290116936031': 'חטיף חלבון Crunch', '0710497376075': 'סוכריות טופי ממולאות בטעמי פירות חמוצים', '8885004563421': 'טופו',
  '7290016988109': 'קרקר כוסמין מלא וכורכום', '7290118428817': 'חטיף שוקולד פיטנס',
  '7290110565930': 'חטיף דגנים שברי אגוזים ושוקולד',
  '0058779133481': 'טילון מגנום',
  '7229110579463': 'שוקולד חלב מעולה עם שברי אגוזי לוז',
  '7290012245343': "צ'יפס זיג זג בחיתוך מסולסל",
  '7290014683761': 'עוגיות קוקוס',
  '7290017275994': 'חלווה אחווה',
  '7290018441473': 'סורבה פסיפלורה ופירות יער',
};

// Products whose identity the name does not tell, or whose name misleads (barcode → target).
export const OFF_TARGET = {
  // not a food name, or a name that cannot be proofread without guessing
  '7296073705970': X('name is a shop name, not a food'), '7290000497570': X('name unclear'), '7290001009222': X('name unclear'), '7290001598528': X('name unclear'),
  '7290013185914': X('name unclear'), '7290018527207': X('name unclear'), '7290018237939': X('name and brand swapped'), '7290005996498': X('name unclear'),
  '7290013579218': X('name unclear'), '7290018237373': X('name unclear'), '7290113865785': X('name unclear'), '7290016524994': X('name unclear'),
  '7290107950206': X('name cut off'), '7290109580043': X('name unclear'),
  // not eaten on its own
  '7290004737900': X('not eaten on its own'), '7290002008224': X('not eaten on its own'), '7290013145628': X('not eaten on its own'), '7290013145840': X('not eaten on its own'),
  '7290015347518': X('not eaten on its own'), '7296073216216': X('not eaten on its own (a spice)'), '7290014693135': X('not eaten on its own'), '7290100680711': X('not eaten on its own'),
  '7290113862081': X('not eaten on its own'), '7290109640464': X('not a grain dish (vegan parmesan flakes); not eaten on its own'),
  // identity or composition decides, and the name does not say (kosher-for-Passover products are often made without the five grains)
  '7290106570177': 'pending', '7290118421801': 'pending', '7290017884455': 'pending', '0645692555942': 'pending', '7290016245318': 'pending', '7290016245325': 'pending',
  '7290018646267': 'pending', '7290016136739': 'pending', '7296073352167': 'pending', '7290018677650': 'pending', '7290014628472': 'pending', '7290000161600': 'pending',
  '7290119383733': 'pending', '7290000110851': 'pending', '7290112331946': 'pending', '7290014762800': 'pending', '7290014760134': 'pending',
  // the right rule or row
  '7290118428817': 'r:cereal-bar',
  '7290109580647': 'r:soup', '7290111566318': 'r:meat-substitute', '7290008693134': 'r:dairy', '7290000181103': 'r:dairy', '7290018296042': 'r:bread',
  '4005496224370': 'r:filled-dough', '7290020076908': 'pending', '7613034275363': 'r:coated-wafer', '3663559000135': 'r:dried-fruit', '7290116934471': 'r:dairy',
  '3662444002766': 'r:sweet-bread', '7290004033682': 'r:sweet-bread', '7290000664002': 'row:שניצל בקמח או בפירורי לחם', '5000159558792': 'r:chocolate',
  '7290001113585': 'row:בוטן אמריקאי', '7290006342553': 'row:בוטן אמריקאי', '7290019078661': 'r:candy', '7290000073767': 'r:grain-cooked', '7290110110758': 'r:drink',
  '7290110117047': 'r:drink', '7290119380992': 'r:drink', '7290008464963': 'r:grape-drink', '7290110115005': 'r:grape-drink', '8711327682603': 'r:ice-cream',
};
