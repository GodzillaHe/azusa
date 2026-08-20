import type { Restaurant } from "./types";

type RestaurantSeed = readonly [
  id: string,
  name: string,
  type: string,
  cost: number,
  area: string,
];

const RESTAURANT_SEEDS: RestaurantSeed[] = [
  ["G7mzvCQ0t5dDU5hY", "君久味·家小厨", "特色菜", 56, "望京周边"],
  ["H9mYJvEwYRVVSFhh", "BAKER&SPICE(望京保利店)", "西餐", 78, "保利广场"],
  ["l1DkdZaX5WnUARP5", "醉面(保利广场店)", "粉面馆", 23, "保利广场"],
  ["iOI8LoaNf7v1Guzj", "苏皮儿烫(保利店)", "麻辣烫", 31, "保利广场"],
  ["k2rs4NtPDubjEAlg", "吉野家(创瑞街保利广场店)", "日式简餐/快餐", 28, "保利广场"],
  ["FJYMpZbdB3Cb2A23", "萨莉亚意式餐厅(望京万象汇店)", "意大利菜", 51, "望京万象汇"],
  ["k8KVG629QQ47i8FF", "SOLDOUT 汉堡三明治(保利广场店)", "西式快餐", 46, "保利广场"],
  ["Ha3MczILdLWh1Yrn", "方砖厂69号炸酱面(望京万象汇店)", "炸酱面", 44, "望京万象汇"],
  ["k9dq9P6zk3DRz3wt", "名人村(保利广场店)", "韩式小吃", 35, "保利广场"],
  ["iUAIWkofRiSbhLvz", "西少爷(来广营保利店)", "快餐简餐", 27, "保利广场"],
  ["H5HXCvNt22TFxhle", "BANG BAGEL缤贝果(望京保利广场店)", "西式快餐", 27, "保利广场"],
  ["l2whBLeIgikd0N1y", "小滇娘·山野云南菜Bistro鲜菌(来广营店)", "特色菜", 67, "来广营"],
  ["k1fhYlJnTxIb3sP1", "米斯特比萨(望京保利店)", "比萨", 65, "保利广场"],
  ["G2gsc0cukc0cSSfm", "宋美丽鸡汤饭(来广营保利广场店)", "快餐简餐", 28, "保利广场"],
  ["H4nONEtk53CCmvL7", "FLY PIZZA&HOODADAK CHICKEN(总店)", "韩式料理", 72, "望京周边"],
  ["G3MYoLCfScpfj8pr", "鲜牛记潮汕牛肉火锅(望京万象汇店)", "潮汕牛肉火锅", 80, "望京万象汇"],
  ["H7MXlQ6BLDPJ8HJL", "鱼你在一起(朝阳保利广场店)", "酸菜鱼/水煮鱼", 33, "保利广场"],
  ["H9qrwQjWMsk1omeD", "SUBWAY赛百味(北京保利广场店)", "西式快餐", 29, "保利广场"],
  ["H5NGB1pj4Dc2Cup6", "鸡西大冷面", "快餐简餐", 26, "望京周边"],
  ["la335yK35WR2xT8g", "Super Model超模厨房(北京保利广场店)", "轻食沙拉", 36, "保利广场"],
  ["Gaipr7ra8qhHt6A3", "爱阁艺(望京店)", "韩式料理", 73, "望京周边"],
  ["kaqCyDax6W6D6k5A", "老北京柴氏·甄选(望京万象汇店)", "烤串", 56, "望京万象汇"],
  ["k1wiP5FTWdl5anJ8", "Wagas沃歌斯(望京万象汇)", "西餐", 73, "望京万象汇"],
  ["k5WZSOo9ucoPb7b5", "金姬家·现压延吉冷面(万象汇店)", "韩式小吃", 46, "望京万象汇"],
  ["k9pKX5PFZ3Z1xwdF", "杨胖子海鲜小馆", "海鲜", 71, "望京周边"],
  ["G3BWFdDjNWLWqOJv", "爅城堡烤房(望京店)", "西餐", 68, "望京周边"],
  ["H5V32hV9ErG7ICSZ", "吃惑止间融合餐(望京店)", "西餐", 62, "望京周边"],
  ["ka3Rl2JxtffMqqzx", "真食净香居·内蒙烧麦(望京万象汇店)", "内蒙菜", 45, "望京万象汇"],
  ["ETmeDvaDs0X7WVWR", "笠夏LIXIA·慢煮甜品(望京万象汇店)", "甜品", 26, "望京万象汇"],
  ["EhACWPOy990b3URG", "Grid Coffee(来广营保利店)", "咖啡", 34, "保利广场"],
];

export const restaurants: Restaurant[] = RESTAURANT_SEEDS.map(
  ([id, name, type, cost, area]) => ({
    id,
    name,
    type,
    cost,
    address: `${area} · 大众点评核对`,
    location: "",
    distance: 0,
    rating: null,
    openNow: null,
    tel: null,
    detailUrl: `https://www.dianping.com/shop/${id}`,
  }),
);
