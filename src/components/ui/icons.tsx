// The app's icon vocabulary, in one place.
//
// Icons come from Phosphor: duotone for icons that carry meaning
// (navigation, stat cards, activity types, feature cards) and bold for the
// small control glyphs (carets, close, plus, search). We import the SSR
// build so the same components work in Server and Client Components with
// no context provider; each export bakes in its default weight and still
// accepts every Phosphor/SVG prop (className, size, weight, color…), so a
// call site can override the weight when it needs to.
import type { ComponentType } from "react";
import type { Icon as PhosphorIcon, IconProps, IconWeight } from "@phosphor-icons/react";
import {
  ArrowLeft as PArrowLeft,
  ArrowRight as PArrowRight,
  ArrowsClockwise as PArrowsClockwise,
  Bell as PBell,
  CalendarBlank as PCalendarBlank,
  CalendarCheck as PCalendarCheck,
  CalendarDots as PCalendarDots,
  Camera as PCamera,
  CaretDown as PCaretDown,
  CaretLeft as PCaretLeft,
  CaretRight as PCaretRight,
  CaretUp as PCaretUp,
  CaretUpDown as PCaretUpDown,
  ChartBar as PChartBar,
  Check as PCheck,
  CheckCircle as PCheckCircle,
  CircleNotch as PCircleNotch,
  Clock as PClock,
  ClockCounterClockwise as PClockCounterClockwise,
  CreditCard as PCreditCard,
  CurrencyInr as PCurrencyInr,
  DotsThreeVertical as PDotsThreeVertical,
  DownloadSimple as PDownloadSimple,
  EnvelopeSimple as PEnvelopeSimple,
  Eye as PEye,
  EyeSlash as PEyeSlash,
  GearSix as PGearSix,
  HandCoins as PHandCoins,
  Info as PInfo,
  List as PList,
  Lock as PLock,
  MagnifyingGlass as PMagnifyingGlass,
  MapPin as PMapPin,
  Moon as PMoon,
  PaperPlaneTilt as PPaperPlaneTilt,
  PencilSimple as PPencilSimple,
  Percent as PPercent,
  Phone as PPhone,
  Plus as PPlus,
  Printer as PPrinter,
  Pulse as PPulse,
  Receipt as PReceipt,
  ShieldCheck as PShieldCheck,
  SignOut as PSignOut,
  SquaresFour as PSquaresFour,
  Sun as PSun,
  Trash as PTrash,
  TrendUp as PTrendUp,
  User as PUser,
  UserCircle as PUserCircle,
  UserPlus as PUserPlus,
  Users as PUsers,
  Wallet as PWallet,
  Warning as PWarning,
  X as PX,
  XCircle as PXCircle,
} from "@phosphor-icons/react/dist/ssr";

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
