"use client";

import {
  ArrowUpRight,
  Building2,
  ChevronDown,
  MapPin,
  RefreshCw,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { pickRestaurant } from "@/lib/random";
import { restaurants } from "@/lib/restaurants";
import type { PickHistoryItem, Restaurant } from "@/lib/types";

const HISTORY_KEY = "fanxuan:history:v2";

function readHistory(): PickHistoryItem[] {
  try {
    const value = window.localStorage.getItem(HISTORY_KEY);
    return value ? (JSON.parse(value) as PickHistoryItem[]).slice(0, 5) : [];
  } catch {
    return [];
  }
}

function formatDistance(distance: number) {
  if (distance === 0) return "点评搜索周边";
  return distance < 1000 ? `${distance} 米` : `${(distance / 1000).toFixed(1)} 公里`;
}

function detailUrl(restaurant: Restaurant) {
  return restaurant.detailUrl ?? `https://www.dianping.com/search/keyword/2/10_${encodeURIComponent(restaurant.name)}`;
}

function RestaurantFacts({ restaurant }: { restaurant: Restaurant }) {
  return (
    <div className="result-facts" aria-label="店家信息">
      <span><MapPin size={16} aria-hidden="true" />{formatDistance(restaurant.distance)}</span>
      <span><Star size={16} aria-hidden="true" />评分看点评</span>
      <span><Users size={16} aria-hidden="true" />{restaurant.cost ? `约 ¥${Math.round(restaurant.cost)}/人` : "人均未知"}</span>
    </div>
  );
}

export function RestaurantPicker() {
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [history, setHistory] = useState<PickHistoryItem[]>([]);
  const [isPicking, setIsPicking] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setHistory(readHistory());
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  function updateHistory(restaurant: Restaurant) {
    setHistory((current) => {
      const next = [
        { ...restaurant, pickedAt: Date.now() },
        ...current.filter((item) => item.id !== restaurant.id),
      ].slice(0, 5);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  function pick() {
    if (isPicking) return;
    setIsPicking(true);
    setSelected(null);

    window.setTimeout(() => {
      const restaurant = pickRestaurant(restaurants, history.map((item) => item.id));
      setSelected(restaurant);
      if (restaurant) updateHistory(restaurant);
      setIsPicking(false);
    }, 760);
  }

  return (
    <main className="app-shell">
      <header className="nav-slab">
        <a className="slab-mark" href="#top" aria-label="饭选首页">饭选<span>。</span></a>
        <p className="nav-note">今日食乜好？</p>
        <a className="nav-action" href="#history">最近选择 <ChevronDown size={16} aria-hidden="true" /></a>
      </header>

      <section className="workbench" id="top">
        <div className="control-pane">
          <div className="intro-copy">
            <p className="service-line"><span aria-hidden="true" /> 30 家备选 · 同事局</p>
            <h1>唔好再问，<br />抽一家就走。</h1>
            <p>只看保利广场与来广营周边，从核对好的本地名单里替大家做决定。</p>
          </div>

          <div className="venue-panel">
            <p className="venue-label">固定出发点</p>
            <div className="venue-address">
              <Building2 size={24} aria-hidden="true" />
              <div>
                <strong>保利广场东座</strong>
                <span>北京市朝阳区来广营地区香槟路66号</span>
              </div>
            </div>
            <p className="venue-range"><MapPin size={16} aria-hidden="true" /> 保利广场及来广营周边</p>
            <p className="data-stamp">已内置 {restaurants.length} 家 · 大众点评核对于 2026-08-07</p>
          </div>
        </div>

        <div className="picker-pane">
          <div className="ticket-edge" aria-hidden="true">午市 · 晚市 · 宵夜 · 午市 · 晚市 · 宵夜</div>
          <div className={`plate-stage ${isPicking ? "is-picking" : ""}`}>
            <div className="plate" aria-hidden="true">
              <span className="plate-ring" />
              <span className="chopstick chopstick-one" />
              <span className="chopstick chopstick-two" />
            </div>

            <div className="plate-content" aria-live="polite">
              {selected ? (
                <div className="result-card">
                  <p className="result-kicker">今日就吃</p>
                  <h2>{selected.name}</h2>
                  <p className="result-type">{selected.type}</p>
                  <RestaurantFacts restaurant={selected} />
                  <p className="result-address">{selected.address}</p>
                  <div className="result-actions">
                    <a href={detailUrl(selected)} target="_blank" rel="noreferrer">
                      <ArrowUpRight size={18} aria-hidden="true" />看点评
                    </a>
                    <button type="button" onClick={pick}>
                      <RefreshCw size={18} aria-hidden="true" />换一家
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-pick">
                  <Sparkles size={25} aria-hidden="true" />
                  <p>{isPicking ? "正在落筷……" : `${restaurants.length} 家等你抽`}</p>
                  <span>{isPicking ? "命运正在转盘" : "不会连续偏爱刚抽过的店"}</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="pick-button"
            onClick={pick}
            disabled={isPicking}
            data-state={isPicking ? "loading" : selected ? "success" : "default"}
          >
            <span>{isPicking ? "抽选中" : selected ? "再抽一次" : "帮我选"}</span>
            <ArrowUpRight size={22} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="history-section" id="history">
        <div className="history-heading">
          <h2>最近吃过</h2>
          <p>最近五次会降低再次抽中的机会。</p>
        </div>
        {history.length ? (
          <ol className="history-list">
            {history.map((item, index) => (
              <li key={item.id}>
                <span className="history-number">{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item.name}</strong><small>{item.type}</small></div>
                <span>{formatDistance(item.distance)}</span>
                <a href={detailUrl(item)} target="_blank" rel="noreferrer" aria-label={`打开 ${item.name} 的大众点评详情`}>
                  <ArrowUpRight size={20} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <div className="history-empty"><p>还没有选择记录</p><span>第一次抽完会留在这里。</span></div>
        )}
      </section>

      <footer className="foot-marquee" aria-label="页尾">
        <div className="foot-marquee-track" aria-hidden="true">
          <span>附近好味 · 少讲多吃 · 抽中就走 ·</span>
          <span>附近好味 · 少讲多吃 · 抽中就走 ·</span>
        </div>
        <p className="visually-hidden">饭选，从保利广场与来广营周边的内置餐厅名单中随机选择。</p>
      </footer>
    </main>
  );
}
