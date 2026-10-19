"use client";
import { useState } from "react";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
const groups=[
{title:"Stellantis India",items:[{label:"Jeep Model Wise",href:"/model-wise/jeep"},{label:"Citroën Model Wise",href:"/model-wise/citroen"},{label:"Budget Planning",href:"/budget-planning"},{label:"Stellantis Network",href:"/stellantis-network"},{label:"Prices",href:"/prices"},{label:"Variant-wise Retail",href:"/variant-wise-retail"}]},
{title:"Industry",items:[{label:"Industry",href:"/industry"},{label:"Manufacturer History",href:"/industry/manufacturers"}]},
{title:"Data Entry",items:[{label:"Data Entry",href:"/data-entry"}]}];
export default function CockpitNavigation({active}){
const [expandedGroup,setExpandedGroup]=useState(null),[menuOpen,setMenuOpen]=useState(false);
const groupLinks=(group,index)=> <section className="cockpitNavGroup" key={group.title}>
<button type="button" className="cockpitNavGroupHeader" aria-expanded={expandedGroup===index} onClick={()=>setExpandedGroup(expandedGroup===index?null:index)}>
<span className="cockpitNavGroupTitle">{group.title}</span><span className={"cockpitNavChevron"+(expandedGroup===index?" open":"")} aria-hidden="true">⌄</span></button>
{expandedGroup===index&&<div className="cockpitNavGroupLinks">{group.items.map(item=><Link key={item.href} href={item.href} onClick={()=>setMenuOpen(false)} className={active===item.href?"active":""} aria-current={active===item.href?"page":undefined}>{item.label}</Link>)}</div>}
</section>;
return <nav className="cockpitNavGroups" aria-label="Main navigation">
<button type="button" className="cockpitMobileMenuButton" aria-expanded={menuOpen} aria-controls="cockpit-mobile-menu" onClick={()=>setMenuOpen(v=>!v)}><span aria-hidden="true">{menuOpen?"×":"☰"}</span><span>Menu</span></button>
<div className={"cockpitMobileMenu"+(menuOpen?" isOpen":"")} id="cockpit-mobile-menu" hidden={!menuOpen}>{groups.map(groupLinks)}<div className="cockpitMenuTheme"><ThemeToggle/></div></div>
<div className="cockpitDesktopNav">{groups.map(groupLinks)}<div className="cockpitDesktopTheme"><ThemeToggle /></div></div>
</nav>;
}