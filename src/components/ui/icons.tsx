// The app's icon vocabulary, in one place.
//
// Icons come from Phosphor: duotone for icons that carry meaning
// (navigation, stat cards, activity types, feature cards) and bold for the
// small control glyphs (carets, close, plus, search). We import each icon
// from its own SSR module — the SSR build needs no context provider, so the
// same components work in Server and Client Components, and per-icon
// imports keep the bundler from touching the other ~1,500 icons. Each
// export bakes in its default weight and still accepts every Phosphor/SVG
// prop (className, size, weight, color…), so a call site can override the
// weight when it needs to.
import type { ComponentType } from "react";
import type { Icon as PhosphorIcon, IconProps, IconWeight } from "@phosphor-icons/react/dist/lib/types";
import { ArrowLeftIcon as PArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { ArrowRightIcon as PArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ArrowsClockwiseIcon as PArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise";
import { BellIcon as PBell } from "@phosphor-icons/react/dist/ssr/Bell";
import { CalendarBlankIcon as PCalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
import { CalendarCheckIcon as PCalendarCheck } from "@phosphor-icons/react/dist/ssr/CalendarCheck";
import { CalendarDotsIcon as PCalendarDots } from "@phosphor-icons/react/dist/ssr/CalendarDots";
import { CameraIcon as PCamera } from "@phosphor-icons/react/dist/ssr/Camera";
import { CaretDownIcon as PCaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CaretLeftIcon as PCaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRightIcon as PCaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { CaretUpIcon as PCaretUp } from "@phosphor-icons/react/dist/ssr/CaretUp";
import { CaretUpDownIcon as PCaretUpDown } from "@phosphor-icons/react/dist/ssr/CaretUpDown";
import { ChartBarIcon as PChartBar } from "@phosphor-icons/react/dist/ssr/ChartBar";
import { CheckIcon as PCheck } from "@phosphor-icons/react/dist/ssr/Check";
import { CheckCircleIcon as PCheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { CircleNotchIcon as PCircleNotch } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { ClockIcon as PClock } from "@phosphor-icons/react/dist/ssr/Clock";
import { ClockCounterClockwiseIcon as PClockCounterClockwise } from "@phosphor-icons/react/dist/ssr/ClockCounterClockwise";
import { CreditCardIcon as PCreditCard } from "@phosphor-icons/react/dist/ssr/CreditCard";
import { CurrencyInrIcon as PCurrencyInr } from "@phosphor-icons/react/dist/ssr/CurrencyInr";
import { DotsThreeVerticalIcon as PDotsThreeVertical } from "@phosphor-icons/react/dist/ssr/DotsThreeVertical";
import { DownloadSimpleIcon as PDownloadSimple } from "@phosphor-icons/react/dist/ssr/DownloadSimple";
import { EnvelopeSimpleIcon as PEnvelopeSimple } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { EyeIcon as PEye } from "@phosphor-icons/react/dist/ssr/Eye";
import { EyeSlashIcon as PEyeSlash } from "@phosphor-icons/react/dist/ssr/EyeSlash";
import { GearSixIcon as PGearSix } from "@phosphor-icons/react/dist/ssr/GearSix";
import { HandCoinsIcon as PHandCoins } from "@phosphor-icons/react/dist/ssr/HandCoins";
import { InfoIcon as PInfo } from "@phosphor-icons/react/dist/ssr/Info";
import { ListIcon as PList } from "@phosphor-icons/react/dist/ssr/List";
import { LockIcon as PLock } from "@phosphor-icons/react/dist/ssr/Lock";
import { MagnifyingGlassIcon as PMagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { MapPinIcon as PMapPin } from "@phosphor-icons/react/dist/ssr/MapPin";
import { MoonIcon as PMoon } from "@phosphor-icons/react/dist/ssr/Moon";
import { PaperPlaneTiltIcon as PPaperPlaneTilt } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { PencilSimpleIcon as PPencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple";
import { PercentIcon as PPercent } from "@phosphor-icons/react/dist/ssr/Percent";
import { PhoneIcon as PPhone } from "@phosphor-icons/react/dist/ssr/Phone";
import { PlusIcon as PPlus } from "@phosphor-icons/react/dist/ssr/Plus";
import { PrinterIcon as PPrinter } from "@phosphor-icons/react/dist/ssr/Printer";
import { PulseIcon as PPulse } from "@phosphor-icons/react/dist/ssr/Pulse";
import { ReceiptIcon as PReceipt } from "@phosphor-icons/react/dist/ssr/Receipt";
import { ShieldCheckIcon as PShieldCheck } from "@phosphor-icons/react/dist/ssr/ShieldCheck";
import { SignOutIcon as PSignOut } from "@phosphor-icons/react/dist/ssr/SignOut";
import { SquaresFourIcon as PSquaresFour } from "@phosphor-icons/react/dist/ssr/SquaresFour";
import { SunIcon as PSun } from "@phosphor-icons/react/dist/ssr/Sun";
import { TrashIcon as PTrash } from "@phosphor-icons/react/dist/ssr/Trash";
import { TrendDownIcon as PTrendDown } from "@phosphor-icons/react/dist/ssr/TrendDown";
import { TrendUpIcon as PTrendUp } from "@phosphor-icons/react/dist/ssr/TrendUp";
import { UserIcon as PUser } from "@phosphor-icons/react/dist/ssr/User";
import { UserCircleIcon as PUserCircle } from "@phosphor-icons/react/dist/ssr/UserCircle";
import { UserPlusIcon as PUserPlus } from "@phosphor-icons/react/dist/ssr/UserPlus";
import { UsersIcon as PUsers } from "@phosphor-icons/react/dist/ssr/Users";
import { WalletIcon as PWallet } from "@phosphor-icons/react/dist/ssr/Wallet";
import { WarningIcon as PWarning } from "@phosphor-icons/react/dist/ssr/Warning";
import { XIcon as PX } from "@phosphor-icons/react/dist/ssr/X";
import { XCircleIcon as PXCircle } from "@phosphor-icons/react/dist/ssr/XCircle";

export type { IconProps };
export type IconComponent = ComponentType<IconProps>;

function withWeight(Base: PhosphorIcon, weight: IconWeight): IconComponent {
  function Icon(props: IconProps) {
    return <Base weight={weight} {...props} />;
  }
  Icon.displayName = Base.displayName ?? "Icon";
  return Icon;
}
const duotone = (Base: PhosphorIcon) => withWeight(Base, "duotone");
const bold = (Base: PhosphorIcon) => withWeight(Base, "bold");

// Navigation & entities
export const LayoutDashboard = duotone(PSquaresFour);
export const Users = duotone(PUsers);
export const User = duotone(PUser);
export const UserPlus = duotone(PUserPlus);
export const UserCircle = duotone(PUserCircle);
export const CreditCard = duotone(PCreditCard);
export const Wallet = duotone(PWallet);
export const HandCoins = duotone(PHandCoins);
export const Receipt = duotone(PReceipt);
export const Percent = duotone(PPercent);
export const TrendingUp = duotone(PTrendUp);
export const TrendingDown = duotone(PTrendDown);
export const FileBarChart = duotone(PChartBar);
export const Activity = duotone(PPulse);

// Time
export const Calendar = duotone(PCalendarBlank);
export const CalendarDays = duotone(PCalendarDots);
export const CalendarClock = duotone(PCalendarCheck);
export const Clock = duotone(PClock);
export const History = duotone(PClockCounterClockwise);

// Status & feedback
export const AlertTriangle = duotone(PWarning);
export const CheckCircle = duotone(PCheckCircle);
export const XCircle = duotone(PXCircle);
export const Info = duotone(PInfo);
export const Bell = duotone(PBell);
export const ShieldCheck = duotone(PShieldCheck);

// Actions
export const Edit = duotone(PPencilSimple);
export const Trash = duotone(PTrash);
export const Eye = duotone(PEye);
export const EyeOff = duotone(PEyeSlash);
export const Send = duotone(PPaperPlaneTilt);
export const Download = duotone(PDownloadSimple);
export const Printer = duotone(PPrinter);
export const Refresh = duotone(PArrowsClockwise);
export const Camera = duotone(PCamera);
export const Lock = duotone(PLock);
export const LogOut = duotone(PSignOut);
export const Settings = duotone(PGearSix);
export const Sun = duotone(PSun);
export const Moon = duotone(PMoon);

// Contact
export const Phone = duotone(PPhone);
export const Mail = duotone(PEnvelopeSimple);
export const MapPin = duotone(PMapPin);

// Small control glyphs
export const Plus = bold(PPlus);
export const Check = bold(PCheck);
export const X = bold(PX);
export const Search = bold(PMagnifyingGlass);
export const Menu = bold(PList);
export const DotsVertical = bold(PDotsThreeVertical);
export const ArrowLeft = bold(PArrowLeft);
export const ArrowRight = bold(PArrowRight);
export const ChevronLeft = bold(PCaretLeft);
export const ChevronRight = bold(PCaretRight);
export const ChevronDown = bold(PCaretDown);
export const CaretUp = bold(PCaretUp);
export const CaretDown = bold(PCaretDown);
export const CaretUpDown = bold(PCaretUpDown);
export const Spinner = bold(PCircleNotch);

// Brand
export const CurrencyInr = bold(PCurrencyInr);
