import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";

// We add the CSS ourselves above (via import), so tell FontAwesome not to
// inject it a second time — avoids a flash of unstyled/oversized icons.
config.autoAddCss = false;
